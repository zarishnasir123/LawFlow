import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { type JSONContent } from "@tiptap/react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Document, Page, pdfjs } from "react-pdf";
import LawyerLayout from "../components/LawyerLayout";
import DocumentSidebar from "../components/documentEditor/DocumentSidebar";
import DocxPreviewSurface from "../components/documentEditor/DocxPreviewSurface";
import SignatureOverlayLayer from "../components/documentEditor/SignatureOverlayLayer";
import PageContextMenu, {
  type PageContextMenuState,
} from "../components/documentEditor/PageContextMenu";
import {
  signaturesApi,
  getSignaturesErrorMessage,
  type SignerRole,
} from "../signatures/api/signatures.api";
import { buildEditorSnapshot } from "../utils/editorSnapshot";
import ContentEditableToolbar from "../components/documentEditor/ContentEditableToolbar";
import TopActionBar from "../components/documentEditor/TopActionBar";
import DownloadModal from "../components/documentEditor/DownloadModal";
import SignatureRequestPanel from "../signatures/components/SignatureRequestPanel";
import { useDocumentEditorStore } from "../store/documentEditor.store";
import { useSignatureRequestsStore } from "../signatures/store/signatureRequests.store";
import { casesApi, caseTemplateApiPath } from "../api/cases.api";
import { mountFloatingImage } from "../utils/floatingImage";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// Document URLs live in one of two universes:
//
//   1. Backend API paths      e.g. "/cases/types/civil_khula/template"
//      → fetched through apiClient (auth headers added automatically).
//   2. Browser-local URLs     blob:, data:, http:, https:
//      → fetched with plain fetch() — these come from file uploads where
//        the bytes already live in memory or on a third-party host.
//
// Telling them apart at the call-site keeps the loader honest about which
// transport to use.
const isApiPath = (url: string) => url.startsWith("/cases/") || url.startsWith("/api/");

export default function CaseDocumentEditor() {
  const { caseId } = useParams({ strict: false }) as { caseId?: string }; // Retrieve generic params
  const navigate = useNavigate();
  const effectiveCaseId = caseId || "default-case";

  const {
    currentDocId,
    setCurrentDocId,
    activeEditorRef,
    documentsById,
    saveDocumentJSON,
    getDocumentJSON,
    setLoading,
    isLoading,
    saveDraft,
    loadDraft,
    addAttachment,
    attachmentsById,
    initializeDefaultBundle,
    bundleItems,
  } = useDocumentEditorStore();

  const {
    getPendingRequests,
    getSignedRequests,
    isCaseFullySigned,
    loadForCase: loadSignatureRequestsForCase,
    create: createSignatureRequests,
  } = useSignatureRequestsStore();

  const [editorContent, setEditorContent] = useState<string | JSONContent>("");
  // Raw .docx bytes for the document currently open in the preview surface.
  // docx-preview consumes this directly — no mammoth/HTML conversion in
  // between, so the rendered pages preserve Word's exact layout (fonts,
  // page breaks, tables, justify).
  const [docxBytes, setDocxBytes] = useState<ArrayBuffer | null>(null);
  // Live references to the rendered <section class="docx"> elements
  // produced by docx-preview. The sidebar's Pages panel uses these for
  // jump-to-page and per-page signature actions.
  const [renderedPages, setRenderedPages] = useState<HTMLElement[]>([]);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isSignaturePanelOpen, setIsSignaturePanelOpen] = useState(false);
  // Right-click context menu state — populated when the lawyer right-
  // clicks a page row in the sidebar OR a rendered section on the
  // canvas. Routes through one handler so both surfaces use the same
  // menu. The menu's three signer options fire the API directly via
  // sendPageForSignature — no panel detour, no pre-tick state needed.
  // The full SignatureRequestPanel is still reachable from the
  // Signatures toolbar button for the bulk / multi-page flow.
  const [pageMenu, setPageMenu] = useState<PageContextMenuState | null>(null);
  // Toast feedback for the right-click signature fast-path. Lives in
  // the editor (not a global store) because the menu's result is
  // case-scoped and should disappear when the lawyer navigates away.
  const [signatureToast, setSignatureToast] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(null);
  const [pdfNumPages, setPdfNumPages] = useState(0);
  const [pdfContainerWidth, setPdfContainerWidth] = useState(0);
  const [pdfReady, setPdfReady] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const signatureCaseId = effectiveCaseId;

  // Refresh the backend-synced signature cache when the case loads /
  // switches. Initial fetch + 15-second poll so the editor reflects
  // newly-collected signatures + status badges in near-real-time
  // without WebSockets. 15s is the sweet spot between freshness and
  // not hammering the backend while the editor sits open.
  useEffect(() => {
    loadSignatureRequestsForCase(signatureCaseId);
    const interval = setInterval(() => {
      // Skip the poll tick if a load is already in flight for this
      // case. Without this guard a slow backend could leave multiple
      // overlapping fetches racing, each clobbering the previous
      // store snapshot when they resolve out of order.
      const state = useSignatureRequestsStore.getState();
      if (state.loadingCaseId === signatureCaseId) return;
      loadSignatureRequestsForCase(signatureCaseId);
    }, 15_000);
    return () => clearInterval(interval);
  }, [signatureCaseId, loadSignatureRequestsForCase]);

  // Auto-save plumbing — see persistEditedHtml below for the saver
  // itself. We use a ref to bridge the effect (which runs early) and
  // the saver (declared after this in the component body) without
  // hitting "used before declaration" or stuffing both into a useRef
  // initializer. Refs are how React handles "I need to call function X
  // from inside a long-lived listener" without re-binding listeners
  // every render.
  const persistEditedHtmlRef = useRef<() => Promise<void>>(async () => {});

  // Two auto-save triggers:
  //   1. On blur from anywhere in the docx-preview host — catches the
  //      "lawyer typed something then clicked away" case. 500ms
  //      debounce so a focus-shuffle inside the canvas (e.g., the
  //      caret moving between sections via mouse) doesn't fire a
  //      flurry of saves.
  //   2. Every 30 seconds — heartbeat for the "lawyer keeps typing
  //      forever without leaving the canvas" case. The saver itself
  //      short-circuits when the snapshot hasn't changed, so this is
  //      cheap when idle.
  // Manual Save Draft (handleSaveDraft above) calls the same saver.
  useEffect(() => {
    if (renderedPages.length === 0) return;
    const host =
      renderedPages[0].closest(".docx-preview-host") ||
      renderedPages[0].closest(".docx-wrapper")?.parentElement;
    if (!host) return;
    let blurTimer: number | null = null;
    const onBlur = () => {
      if (blurTimer !== null) window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        void persistEditedHtmlRef.current();
      }, 500);
    };
    host.addEventListener("focusout", onBlur as EventListener);
    const interval = window.setInterval(() => {
      void persistEditedHtmlRef.current();
    }, 30_000);
    return () => {
      host.removeEventListener("focusout", onBlur as EventListener);
      window.clearInterval(interval);
      if (blurTimer !== null) window.clearTimeout(blurTimer);
    };
  }, [renderedPages]);

  // Pending requests — used both to surface the toolbar badge count
  // and to lock per-page surfaces (sidebar send icon + signature
  // panel checkboxes) so the lawyer can't fire a duplicate request
  // for a page that's still in flight with its original recipient.
  const pendingSignatureRequests = getPendingRequests(signatureCaseId);
  const signaturePendingCount = pendingSignatureRequests.length;

  const pendingPageIndices = useMemo(() => {
    const set = new Set<number>();
    for (const req of pendingSignatureRequests) {
      for (const idx of req.pageIndices || []) set.add(idx);
    }
    return set;
  }, [pendingSignatureRequests]);

  // Pull the latest signed requests from the cache for two consumers:
  //   1. SignatureOverlayLayer renders each one's PNG on the canvas at
  //      its captured placement.
  //   2. The PAGES sidebar's per-page status badges (client / lawyer /
  //      both) derive from these rows' pageIndices + signer_role.
  const signedSignatureRequests = getSignedRequests(signatureCaseId);

  const signatureStatusByPageIndex = useMemo(() => {
    const map: Record<number, { clientSigned: boolean; lawyerSigned: boolean }> = {};
    for (const req of signedSignatureRequests) {
      const indices = req.pageIndices || [];
      for (const idx of indices) {
        const entry = map[idx] || { clientSigned: false, lawyerSigned: false };
        if (req.signerRole === "client") entry.clientSigned = true;
        if (req.signerRole === "lawyer") entry.lawyerSigned = true;
        map[idx] = entry;
      }
    }
    return map;
  }, [signedSignatureRequests]);

  const caseFullySigned = isCaseFullySigned(signatureCaseId);

  // Invalidate the case useQuery when the case transitions to
  // fully-signed so the freshly-populated signedPdfStoragePath +
  // signedPdfGeneratedAt on the case row are visible to consumers
  // (the Download CTA, the submit-page preview). Without this the
  // useQuery cache stays stale for up to 60s and the editor would
  // briefly show "Untitled document" while the response loaded —
  // the root cause of the post-signing blank state.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (caseFullySigned && caseId && caseId !== "default-case") {
      queryClient.invalidateQueries({ queryKey: ["case", effectiveCaseId] });
    }
  }, [caseFullySigned, caseId, effectiveCaseId, queryClient]);

  // Fetch the case so the editor knows which backend-generated template to
  // load. caseId is the only thing the route gives us — case_type code +
  // display name come from the server (single source of truth).
  //
  // The "default-case" fallback exists for the deep-link path
  // /lawyer-case-editor (no caseId); in that mode the editor is read-only
  // until the lawyer comes through the wizard.
  const { data: caseRecord } = useQuery({
    queryKey: ["case", effectiveCaseId],
    queryFn: () => casesApi.getCase(effectiveCaseId),
    enabled: Boolean(caseId) && caseId !== "default-case",
    staleTime: 1000 * 60,
  });

  // Load draft on mount.
  useEffect(() => {
    loadDraft(effectiveCaseId);
  }, [loadDraft, effectiveCaseId]);

  // Seed the bundle with a single document derived from the case's
  // case_types.code. The bundle stays a one-doc-per-case-type model — the
  // composite .docx already contains all the legal sections (Cause Title,
  // Plaint, Verification, Schedules, Vakalatnama) separated by Heading 1
  // markers, so a section navigator can be built off the document itself
  // in Phase 2 rather than off the bundle.
  useEffect(() => {
    if (!caseRecord) return;
    initializeDefaultBundle([
      {
        id: caseRecord.caseTypeCode,
        title: caseRecord.caseTypeName,
        url: caseTemplateApiPath(caseRecord.caseTypeCode)
      }
    ]);
  }, [caseRecord, initializeDefaultBundle]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentDocId && activeEditorRef) {
        saveDocumentJSON(currentDocId, activeEditorRef.getJSON());
        saveDraft(effectiveCaseId);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentDocId, activeEditorRef, saveDocumentJSON, saveDraft, effectiveCaseId]);

  useEffect(() => {
    const storageKey = effectiveCaseId
      ? `lawyer_case_draft_${effectiveCaseId}`
      : "lawyer_case_draft";

    const handleBeforeUnload = () => {
      // If the draft key was manually removed (e.g. via DevTools),
      // do not recreate it on refresh.
      if (!localStorage.getItem(storageKey)) {
        return;
      }
      if (currentDocId && activeEditorRef) {
        saveDocumentJSON(currentDocId, activeEditorRef.getJSON());
      }
      saveDraft(effectiveCaseId);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [currentDocId, activeEditorRef, saveDocumentJSON, saveDraft, effectiveCaseId]);

  const loadDocument = useCallback(
    async (docId: string) => {
      // The Tiptap-era cached-JSON / legacy-HTML early returns are gone —
      // they bailed before fetching the ArrayBuffer, which left docxBytes
      // null when the editor re-mounted (the "No document loaded" bug
      // after navigating away and back). docx-preview always needs the
      // raw bytes, so we always go through the fetch path.
      const docData = documentsById[docId];
      const templateUrl = docData?.url;
      if (!templateUrl) return;

      setCurrentDocId(docId);
      setLoading(true);

      try {
        let arrayBuffer: ArrayBuffer;
        if (isApiPath(templateUrl)) {
          // Backend-served template — extract case_types.code from the path
          // and use the typed API helper so we get auth + error mapping for
          // free.
          const match = templateUrl.match(/\/cases\/types\/([^/]+)\/template/);
          const code = match?.[1];
          if (!code) {
            throw new Error(`Unrecognised template path: ${templateUrl}`);
          }
          arrayBuffer = await casesApi.fetchCaseTemplateBytes(code);
        } else {
          // Local / uploaded URL (blob:, data:, http:) — plain fetch.
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          const response = await fetch(templateUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`);
          }
          arrayBuffer = await response.arrayBuffer();
        }
        // docx-preview renders directly from the bytes — no HTML conversion
        // step. Storing the buffer (not the HTML) preserves Word's exact
        // formatting and lets us pipe the same bytes into per-page PDF
        // extraction for the signature workflow later.
        setDocxBytes(arrayBuffer);
        setRenderedPages([]); // cleared until the new render finishes
      } catch (error) {
        const message =
          error instanceof DOMException && error.name === "AbortError"
            ? "Request timed out while loading the template."
            : "Unable to load the template. Please confirm the template exists for this case type.";
        console.error(`[DOCX Loader] Error loading document:`, error);
        setEditorContent(`<p>${message}</p>`);
      } finally {
        setLoading(false);
      }
    },
    [getDocumentJSON, documentsById, setCurrentDocId, setLoading]
  );

  // Auto-open the case template by default. With uploaded DOCs sitting
  // at the top of the bundle (for easy drag access), bundleItems[0] is
  // no longer reliable as "the doc to render" — we look up the template
  // explicitly via documentsById[*].isTemplate so the canvas always
  // boots up showing the template + interleaved page-insertions.
  useEffect(() => {
    const docItems = bundleItems.filter((item) => item.type === "DOC");
    if (docItems.length === 0) {
      if (currentDocId) {
        setCurrentDocId(null);
      }
      setEditorContent("");
      return;
    }

    const validDocIds = new Set(docItems.map((item) => item.refId));
    const templateDoc = docItems.find(
      (item) => documentsById[item.refId]?.isTemplate
    );
    const nextDocId = currentDocId && validDocIds.has(currentDocId)
      ? currentDocId
      : templateDoc?.refId || docItems[0]?.refId;

    // Also reload when docxBytes is null even if currentDocId already
    // matches — this happens after the lawyer navigates away and comes
    // back: bundle/currentDocId are restored from the saved draft, but
    // docxBytes is local React state and starts fresh at null. Without
    // this trigger the editor would render "No document loaded".
    //
    // Guard: only attempt the load when documentsById has the doc's
    // url ready. A draft restored from localStorage may have bundle
    // items pointing at refIds that aren't yet populated in
    // documentsById (the seed effect runs *after* caseRecord loads).
    // Without this guard, the auto-open fires too early, loadDocument
    // silently no-ops on a missing url, and the editor sticks on
    // "No document loaded" until the next bundle change re-triggers
    // the effect.
    if (nextDocId && (nextDocId !== currentDocId || !docxBytes)) {
      if (!documentsById[nextDocId]?.url) return;
      loadDocument(nextDocId);
    }
  }, [bundleItems, currentDocId, docxBytes, documentsById, loadDocument, setCurrentDocId]);

  const handleDocumentSelect = (docId: string) => {
    // Save current document before switching
    if (currentDocId && activeEditorRef) {
      saveDocumentJSON(currentDocId, activeEditorRef.getJSON());
    }

    if (docId !== currentDocId) {
      loadDocument(docId);
    }
  };

  // Track the last HTML we shipped to the backend so the auto-save
  // loop can skip when nothing changed. Stored on a ref so React
  // doesn't re-render on every keystroke.
  const lastSavedHtmlRef = useRef<string>("");
  const autoSaveInFlightRef = useRef<boolean>(false);

  // Persist the editor's current HTML state to cases.edited_html on
  // the backend. Skips when:
  //   - We're not in a real case (default-case fallback)
  //   - The pages haven't rendered yet (snapshot would be empty)
  //   - The snapshot is identical to the last shipped one
  //   - Another auto-save is already in flight (avoid stampede)
  // Errors are logged + swallowed; the next blur/interval retries.
  const persistEditedHtml = useCallback(async () => {
    if (!caseId || caseId === "default-case") return;
    if (renderedPages.length === 0) return;
    if (autoSaveInFlightRef.current) return;
    const snapshot = buildEditorSnapshot(renderedPages);
    if (!snapshot || snapshot === lastSavedHtmlRef.current) return;

    autoSaveInFlightRef.current = true;
    try {
      await casesApi.saveEditedHtml(effectiveCaseId, snapshot);
      lastSavedHtmlRef.current = snapshot;
    } catch (err) {
      console.error("[AUTO SAVE FAILED]", {
        caseId: effectiveCaseId,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      autoSaveInFlightRef.current = false;
    }
  }, [caseId, effectiveCaseId, renderedPages]);

  // Keep the ref pointing at the latest closure so the long-lived
  // blur/interval listeners above always call the fresh function.
  useEffect(() => {
    persistEditedHtmlRef.current = persistEditedHtml;
  }, [persistEditedHtml]);

  const handleSaveDraft = () => {
    if (currentDocId && activeEditorRef) {
      saveDocumentJSON(currentDocId, activeEditorRef.getJSON());
    }
    saveDraft(effectiveCaseId);
    // Manual Save Draft also pushes the latest HTML to the backend so
    // the lawyer can recover the case on a different device.
    void persistEditedHtml();
  };

  const handleDownload = () => {
    setIsDownloadModalOpen(true);
  };

  // Right-click "Send for Signature" fast path. Builds the API payload
  // straight from the clicked page + chosen signer and posts via the
  // store (which refreshes the per-page badges on success). The
  // editor's DOM is NOT touched — the request travels through the
  // network, not through the rendered .docx-wrapper, so the user's
  // hard formatting-preservation invariant holds.
  const sendPageForSignature = async (
    pageIndex: number,
    signer: "client" | "lawyer" | "both"
  ) => {
    if (!caseId || caseId === "default-case") return;
    if (renderedPages.length === 0) return;

    // Client signing needs a known recipient — bail with an actionable
    // message rather than firing a 400 the lawyer can't fix without
    // the context.
    const needsClient = signer === "client" || signer === "both";
    if (needsClient && !caseRecord?.clientEmail) {
      setSignatureToast({
        tone: "error",
        message:
          "Add a client email on this case before sending for client signature.",
      });
      return;
    }

    const signers: SignerRole[] =
      signer === "both" ? ["client", "lawyer"] : [signer];

    try {
      await createSignatureRequests(effectiveCaseId, {
        clientEmail: needsClient ? caseRecord!.clientEmail! : undefined,
        pageAssignments: [{ pageIndex, signers }],
        documentHtmlSnapshot: buildEditorSnapshot(renderedPages),
      });
      const label =
        signer === "both"
          ? "client + lawyer"
          : signer === "client"
            ? "client"
            : "lawyer";
      setSignatureToast({
        tone: "success",
        message: `Signature request sent to ${label} for page ${pageIndex + 1}.`,
      });
    } catch (err) {
      setSignatureToast({
        tone: "error",
        message: getSignaturesErrorMessage(err),
      });
    }
  };

  // Auto-dismiss the toast after 4s so it doesn't loiter while the
  // lawyer keeps editing. Clicking the toast still dismisses it
  // immediately via the inline onClick handler below.
  useEffect(() => {
    if (!signatureToast) return;
    const t = window.setTimeout(() => setSignatureToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [signatureToast]);

  // Fetch a short-lived signed URL for the compiled signed-case PDF
  // and open it in a new tab. URLs expire in 5 minutes so we always
  // ask the server fresh — no client-side caching.
  const handleDownloadSignedPdf = async () => {
    try {
      const { downloadUrl } = await signaturesApi.downloadSignedPdf(
        signatureCaseId
      );
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      // 409 = signing not complete yet (button shouldn't have shown);
      // anything else = transport or storage misconfig. Surface the
      // server's message rather than swallowing.
      alert(getSignaturesErrorMessage(err));
    }
  };

  const handleAddAttachment = () => {
    attachmentInputRef.current?.click();
  };

  // Attachment upload — PNG/JPG only. Lawyer uploads CNIC scans /
  // evidence photos, which land in the sidebar bundle and can then be
  // dragged onto a specific page in the document as a floating image
  // overlay. Non-image files are rejected at the input layer (the
  // hidden <input> already restricts via `accept`), but we double-check
  // the MIME here so a drag-and-drop or paste-driven upload can't
  // slip past.
  const handleAttachmentUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
      return;
    }

    const url = URL.createObjectURL(file);
    addAttachment({
      name: file.name,
      type: file.type,
      size: file.size,
      url,
    });
    saveDraft(effectiveCaseId);

    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  };

  // Drops the image onto the page as a "floating" image — Word's
  // "In Front of Text" positioning. The image becomes an absolutely-
  // positioned overlay on the page, draggable anywhere and resizable
  // from any of its four corners with aspect ratio preserved. Doesn't
  // disturb the underlying text flow at all.
  const handleImageDropped = (
    refId: string,
    clientX: number,
    clientY: number
  ) => {
    const attachment = attachmentsById[refId];
    if (!attachment || !attachment.url) return;

    // Find which page (section.docx) the drop landed on. elementFromPoint
    // gives us the topmost element at the cursor — closest("section.docx")
    // walks up to the page container.
    const elementAtPoint = document.elementFromPoint(clientX, clientY);
    const page = elementAtPoint?.closest("section.docx") as HTMLElement | null;
    if (!page) return;

    // Translate viewport coords → page-relative coords.
    const pageRect = page.getBoundingClientRect();
    const leftInPage = clientX - pageRect.left;
    const topInPage = clientY - pageRect.top;

    mountFloatingImage({
      src: attachment.url,
      alt: attachment.name,
      page,
      left: leftInPage,
      top: topInPage,
      // Stamp the wrapper with the source attachment id so a second
      // drag of the same row relocates the existing image instead of
      // duplicating it. Without this every drag would create another
      // copy stacked on the previous one.
      attachmentId: refId,
      onChange: () => saveDraft(effectiveCaseId),
    });

    saveDraft(effectiveCaseId);
  };

  const currentDocTitle =
    (currentDocId && documentsById[currentDocId]?.title) || "Document";
  const selectedAttachment = selectedAttachmentId
    ? attachmentsById[selectedAttachmentId]
    : null;
  const isAttachmentView = Boolean(selectedAttachment);

  useEffect(() => {
    const element = pdfContainerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const nextWidth = element.clientWidth;
      setPdfContainerWidth((prev) =>
        Math.abs(prev - nextWidth) > 2 ? nextWidth : prev
      );
    });
    observer.observe(element);
    setPdfContainerWidth(element.clientWidth);
    return () => observer.disconnect();
  }, [selectedAttachmentId]);

  useEffect(() => {
    setPdfNumPages(0);
    setPdfReady(false);
  }, [selectedAttachmentId]);

  return (
    <LawyerLayout
      brandTitle="LawFlow"
      brandSubtitle="Case Document Preparation"
    >
      {/* Pin the editor to the viewport below the dashboard header so the
          formatting toolbar + sidebar stay in place while the document
          itself scrolls. The fixed 72px is the rendered height of the
          dashboard header. */}
      <div className="fixed inset-x-0 top-[72px] bottom-0 flex flex-col bg-gray-100 overflow-hidden">
        <TopActionBar
          docTitle={caseRecord?.title || caseRecord?.caseTypeName}
          docSubtitle={caseRecord?.caseTypeName && caseRecord?.title
            ? caseRecord.caseTypeName
            : null}
          onSaveDraft={handleSaveDraft}
          onDownload={handleDownload}
          onRequestSignatures={() => setIsSignaturePanelOpen(true)}
          signaturePendingCount={signaturePendingCount}
          onSubmitCase={() =>
            navigate({ to: `/lawyer-submit-case/${effectiveCaseId}` })
          }
          onAddAttachment={handleAddAttachment}
          // Download signed PDF: only surfaced once every required
          // signature is in. Backend compiles synchronously on the last
          // signer's submit, so by the time this is true the PDF is
          // already in Storage. Click → short-lived signed URL → new tab.
          onDownloadSignedPdf={caseFullySigned ? handleDownloadSignedPdf : undefined}
        />

        <div className="flex flex-1 overflow-hidden">
          <DocumentSidebar
            onDocumentSelect={handleDocumentSelect}
            onAttachmentSelect={(attachmentId) => {
              setSelectedAttachmentId(attachmentId);
              if (attachmentId) {
                setCurrentDocId(null);
              }
            }}
            caseId={caseId}
            pages={renderedPages}
            signatureStatusByPageIndex={signatureStatusByPageIndex}
            pendingPageIndices={pendingPageIndices}
            onSendPageToClient={() => {
              // Opens the signature panel. Per-page extraction (DOCX →
              // PDF for one page) is wired up in the next sub-phase;
              // for now this opens the existing signature panel so the
              // lawyer sees the flow.
              setIsSignaturePanelOpen(true);
            }}
            onPageContextMenu={(pageIndex, x, y) =>
              setPageMenu({ pageIndex, x, y })
            }
          />
          {isAttachmentView && selectedAttachment ? (
            <div className="flex-1 overflow-auto bg-white p-6">
              <div className="mx-auto w-full max-w-4xl rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
                <div className="border-b border-gray-200 pb-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedAttachment.name}
                  </p>
                  <p className="text-xs text-gray-500">{selectedAttachment.type}</p>
                </div>
                <div className="mt-4 h-[75vh] overflow-hidden rounded-lg border border-gray-200 bg-white">
                  {selectedAttachment.type.includes("pdf") ? (
                    <div
                      ref={pdfContainerRef}
                      className="pdf-scroll h-full w-full overflow-y-auto overflow-x-hidden bg-white"
                      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                      <style>{`
                        .pdf-scroll::-webkit-scrollbar {
                          width: 0px;
                          height: 0px;
                        }
                      `}</style>
                      <Document
                        file={selectedAttachment.url}
                        onLoadSuccess={(doc) => setPdfNumPages(doc.numPages)}
                      >
                        {pdfNumPages > 0 && pdfContainerWidth > 0 ? (
                          Array.from({ length: pdfNumPages }, (_, index) => (
                            <div
                              key={`pdf-page-${index + 1}`}
                              className="mx-auto mb-6 w-full bg-white"
                            >
                              <Page
                                pageNumber={index + 1}
                                width={Math.max(pdfContainerWidth - 24, 320)}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                onRenderSuccess={() => {
                                  if (index === 0) {
                                    setPdfReady(true);
                                  }
                                }}
                              />
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-sm text-gray-500">Preparing PDF preview...</div>
                        )}
                      </Document>
                      {!pdfReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                          <div className="h-9 w-9 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                        </div>
                      )}
                    </div>
                  ) : selectedAttachment.type.includes("image") ? (
                    <img
                      src={selectedAttachment.url}
                      alt={selectedAttachment.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-500">
                      Preview is not available for this file type.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Stack the formatting toolbar above the page surface so it
            // hovers as a fixed strip while the lawyer scrolls through
            // pages — same pattern as Word's ribbon.
            <div className="flex flex-1 flex-col overflow-hidden">
              <ContentEditableToolbar
                onSaveDraft={handleSaveDraft}
                onDownload={handleDownload}
                onAddAttachment={handleAddAttachment}
              />
              <div className="flex-1 overflow-hidden">
                <DocxPreviewSurface
                  arrayBuffer={docxBytes}
                  editedHtml={caseRecord?.editedHtml ?? null}
                  isLoading={isLoading}
                  onPagesReady={setRenderedPages}
                  onImageDropped={handleImageDropped}
                  onPageContextMenu={(pageIndex, x, y) =>
                    setPageMenu({ pageIndex, x, y })
                  }
                  editable
                />
                {/* Read-only signature overlay layer. Renders the
                    captured signature PNGs at their page-fractional
                    placements as the lawyer edits — so the editor view
                    matches what the compiled signed PDF will look like.
                    Updates whenever the 15s poll surfaces new signed
                    rows; pointer-events: none keeps the underlying
                    contenteditable text fully accessible. */}
                <SignatureOverlayLayer
                  pages={renderedPages}
                  signedRequests={signedSignatureRequests}
                />
              </div>
            </div>
          )}
        </div>

        <DownloadModal
          isOpen={isDownloadModalOpen}
          onClose={() => setIsDownloadModalOpen(false)}
          currentDocTitle={currentDocTitle}
          currentDocContent={activeEditorRef?.getHTML() || (typeof editorContent === 'string' ? editorContent : "")}
          selectedAttachmentId={selectedAttachmentId}
        />

        {/* Signature Request Panel — bulk / multi-page flow, opened
            from the Signatures toolbar button. The right-click menu
            uses its own one-click fast-path (sendPageForSignature)
            and never opens this panel. */}
        {isSignaturePanelOpen && (
          <SignatureRequestPanel
            caseId={effectiveCaseId}
            pages={renderedPages}
            onClose={() => setIsSignaturePanelOpen(false)}
          />
        )}

        {/* Right-click context menu. Sidebar AND canvas both surface the
            same {pageIndex, x, y} into pageMenu; this component handles
            closing on outside-click / Escape / scroll. The three signer
            options (Client / Lawyer / Both) fire the API call directly
            via sendPageForSignature — no panel, fewest clicks. The
            advanced multi-page bulk flow stays on the Signatures
            toolbar button (SignatureRequestPanel). */}
        {pageMenu && (
          <PageContextMenu
            state={pageMenu}
            onClose={() => setPageMenu(null)}
            onSend={(pageIndex, signer) => {
              void sendPageForSignature(pageIndex, signer);
            }}
          />
        )}

        {/* Bottom-center toast for the right-click send result.
            Auto-dismisses after 4s; tap to dismiss earlier. Lives
            outside the document editor's main flex so it doesn't
            push pages around. */}
        {signatureToast && (
          <button
            type="button"
            onClick={() => setSignatureToast(null)}
            className={`fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
              signatureToast.tone === "success"
                ? "bg-emerald-600 text-white"
                : "bg-rose-600 text-white"
            }`}
          >
            {signatureToast.message}
          </button>
        )}

        {/* Hidden file input for attachment uploads (PNG/JPG only) */}
        <input
          ref={attachmentInputRef}
          type="file"
          accept=".jpg,.jpeg,.png"
          onChange={handleAttachmentUpload}
          className="hidden"
        />
      </div>
    </LawyerLayout>
  );
}
