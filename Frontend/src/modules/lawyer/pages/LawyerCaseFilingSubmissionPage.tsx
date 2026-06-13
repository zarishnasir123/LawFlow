import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Paperclip,
  UploadCloud,
} from "lucide-react";
import * as mammoth from "mammoth";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import type { JSONContent } from "@tiptap/react";
import { AttachmentBlock } from "../extensions/AttachmentBlock";
import { ImageAttachment } from "../extensions/ImageAttachment";
import { pdfjs } from "react-pdf";
import { casesApi, getCasesErrorMessage, SUPPORTED_TEHSILS } from "../api/cases.api";
import { signaturesApi, getSignaturesErrorMessage } from "../signatures/api/signatures.api";
import LawyerLayout from "../components/LawyerLayout";
import DocxPreviewSurface from "../components/documentEditor/DocxPreviewSurface";
import { applyPriorCapturesToHost } from "../utils/capturePages";
import type { SignedPageCapture } from "../../../shared/api/mySignatures.api";
import { useDocumentEditorStore } from "../store/documentEditor.store";
import SubmitConfirmationModal from "../components/caseFiling/SubmitConfirmationModal";
import { useCaseFilingStore } from "../store/caseFiling.store";
import { formatFilingDateTime } from "../utils/caseFiling.utils";
import { getCaseDisplayTitle } from "../../../shared/utils/caseDisplay";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const exportExtensions = [
  StarterKit,
  TextAlign.configure({
    types: ["heading", "paragraph"],
    alignments: ["left", "center", "right", "justify"],
  }),
  Table.configure({
    resizable: true,
    HTMLAttributes: {
      class: "border-collapse table-auto w-full",
    },
  }),
  TableRow,
  TableHeader.configure({
    HTMLAttributes: {
      class: "border border-gray-300 px-4 py-2 bg-gray-100 font-bold",
    },
  }),
  TableCell.configure({
    HTMLAttributes: {
      class: "border border-gray-300 px-4 py-2",
    },
  }),
  AttachmentBlock,
  ImageAttachment,
];

function resolveTemplateUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
}

// Rasterize every page of a PDF (given a URL) to a PNG data URL. Shared by the
// complete-case-file preview (to pull the signed pages back out of the
// compiled signed.pdf for overlaying) and the "Download Complete PDF" bundle
// builder (to flatten PDF attachments into printable images).
async function renderPdfPagesToDataUrls(url: string): Promise<string[]> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) continue;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    images.push(canvas.toDataURL("image/png"));
  }
  return images;
}

export default function LawyerCaseFilingSubmissionPage() {
  const params = useParams({ strict: false }) as { caseId?: string };
  const queryClient = useQueryClient();
  const {
    ensureCaseContext,
    getCaseById,
    getBundleByCaseId,
    refreshBundleFromWorkspace,
    mockDownloadBundle,
  } = useCaseFilingStore();

  const selectedCaseId = params.caseId || "default-case";
  const filingCase = getCaseById(selectedCaseId);
  const bundle = getBundleByCaseId(selectedCaseId);

  const [feedback, setFeedback] = useState<{
    tone: "success" | "info" | "error";
    message: string;
  } | null>(null);
  const [successModalMessage, setSuccessModalMessage] = useState<string | null>(
    null
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Surfaces a backend validation / submission error inside the confirmation
  // modal (e.g. "Select a court/tehsil before submitting", "Sign the case file
  // before submitting") so the lawyer can fix it without losing the modal.
  const [technicalError, setTechnicalError] = useState<string | undefined>();
  // Lets the lawyer assign / change the case's court-tehsil on this page —
  // needed because a tehsil is required before submitting and older cases
  // (created before tehsil routing existed) have none. null means "untouched",
  // so the select falls back to the saved value from the backend case.
  const [tehsilDraft, setTehsilDraft] = useState<string | null>(null);

  const displayCaseTitle = getCaseDisplayTitle(filingCase?.title, selectedCaseId);

  // Pull the backend case record so we can detect whether the signing
  // workflow finished (signedPdfStoragePath is set on the row only after
  // every signature_request reaches status='signed' AND the pdf-lib
  // compile job posts the artifact to Supabase Storage). The editor
  // invalidates this query on caseFullySigned so by the time the lawyer
  // lands here, the field is fresh.
  const { data: backendCase, isLoading: backendCaseLoading } = useQuery({
    queryKey: ["case", selectedCaseId],
    queryFn: () => casesApi.getCase(selectedCaseId),
    enabled: Boolean(selectedCaseId) && selectedCaseId !== "default-case",
    // Always pull the freshest edited_html when the lawyer lands here (or
    // refocuses the tab) so edits made in the editor show up without a manual
    // page refresh. The editor saves to the backend but doesn't push its
    // edits into this query's cache, so without an on-mount refetch React
    // Query would keep serving the stale, first-loaded copy.
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Signature requests for this case — we only need the set of absolute page
  // indices that have actually been signed so we can overlay the signed
  // captures onto the matching sections of the full-document preview.
  const { data: signatureData } = useQuery({
    queryKey: ["case", selectedCaseId, "signature-requests"],
    queryFn: () => signaturesApi.listForCase(selectedCaseId),
    enabled: Boolean(selectedCaseId) && selectedCaseId !== "default-case",
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Real submission. Hits POST /api/cases/:caseId/submit; the backend enforces
  // the status guard ('draft'/'returned'), the tehsil requirement, and the
  // signed-PDF requirement, returning the updated case on success. We keep the
  // confirmation-modal UX, but everything it shows now reflects the actual
  // server result: a backend 400 (no tehsil / not signed) lands in the modal's
  // error slot, and success only fires after the row is really 'submitted'.
  const submitMutation = useMutation({
    mutationFn: (caseId: string) => casesApi.submitCase(caseId),
    onSuccess: () => {
      // Capture the pre-submit status before invalidation refetches the row so
      // we can word the success message (first submit vs. resubmit) correctly.
      const wasResubmission = backendCase?.status === "returned";
      // Refresh the case detail + the lawyer's case list so the new
      // 'submitted' status (and cleared returned state) shows everywhere
      // without a manual reload.
      queryClient.invalidateQueries({ queryKey: ["case", selectedCaseId] });
      queryClient.invalidateQueries({ queryKey: ["lawyer", "cases"] });
      setConfirmOpen(false);
      setTechnicalError(undefined);
      setFeedback(null);
      setSuccessModalMessage(
        wasResubmission
          ? "Corrected case file successfully resubmitted to the registrar for review."
          : "Case successfully submitted to the registrar for review."
      );
    },
    onError: (error) => {
      // Surface the backend's specific validation message inside the modal so
      // the lawyer can read it and fix the missing step. The modal stays open.
      setTechnicalError(getCasesErrorMessage(error));
    },
  });

  // Persist the chosen court/tehsil to the case (PATCH /api/cases/:id). On
  // success we refetch so the submit prerequisite clears and the confirmation
  // modal's destination text updates; resetting the draft lets the select fall
  // back to the freshly-saved value.
  const saveTehsilMutation = useMutation({
    mutationFn: (tehsil: string) =>
      casesApi.updateCase(selectedCaseId, { assignedTehsil: tehsil }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", selectedCaseId] });
      queryClient.invalidateQueries({ queryKey: ["lawyer", "cases"] });
      setTehsilDraft(null);
      setFeedback({ tone: "info", message: "Court / tehsil saved." });
    },
    onError: (error) => {
      setFeedback({ tone: "error", message: getCasesErrorMessage(error) });
    },
  });

  const signedPageIndices = useMemo(() => {
    const indices = new Set<number>();
    for (const req of signatureData?.signatureRequests ?? []) {
      if (req.status !== "signed") continue;
      for (const idx of req.pageIndices ?? []) indices.add(idx);
    }
    return Array.from(indices).sort((a, b) => a - b);
  }, [signatureData]);
  const signedPageIndicesKey = signedPageIndices.join(",");

  // The compiled signed.pdf contains exactly the signed pages, in ascending
  // page-index order. We pull a fresh short-lived (5-min) Supabase signed URL
  // only when a signed PDF exists, rasterize each page back to a PNG, and key
  // them by their absolute page index so they can be overlaid onto the right
  // section of the full edited document.
  const signedPdfStoragePath = backendCase?.signedPdfStoragePath ?? null;
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [signedPdfError, setSignedPdfError] = useState<string | null>(null);
  const [signedCaptures, setSignedCaptures] = useState<SignedPageCapture[]>([]);
  const [renderedPages, setRenderedPages] = useState<HTMLElement[]>([]);

  // Refetch a fresh signed URL whenever the signed-pdf path appears / changes
  // on the case row. Storage paths can rotate if the lawyer re-collects
  // signatures, so we key the effect on the path (not just a boolean).
  useEffect(() => {
    if (!signedPdfStoragePath) {
      setSignedPdfUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { downloadUrl } = await signaturesApi.downloadSignedPdf(
          selectedCaseId
        );
        if (cancelled) return;
        setSignedPdfUrl(downloadUrl);
        setSignedPdfError(null);
      } catch (err) {
        if (cancelled) return;
        setSignedPdfError(getSignaturesErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCaseId, signedPdfStoragePath]);

  // Rasterize the signed.pdf into per-page captures keyed by absolute page
  // index. signedPageIndices[i] corresponds to signed-pdf page i (both are
  // ascending), so we zip them together.
  useEffect(() => {
    if (!signedPdfUrl || signedPageIndices.length === 0) {
      setSignedCaptures([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const images = await renderPdfPagesToDataUrls(signedPdfUrl);
        if (cancelled) return;
        const captures: SignedPageCapture[] = [];
        signedPageIndices.forEach((pageIndex, i) => {
          if (images[i]) captures.push({ pageIndex, imageDataUrl: images[i] });
        });
        setSignedCaptures(captures);
      } catch (err) {
        if (cancelled) return;
        setSignedPdfError(getSignaturesErrorMessage(err));
        setSignedCaptures([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // signedPageIndicesKey is the stable string form of signedPageIndices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedPdfUrl, signedPageIndicesKey]);

  // Overlay the signed captures onto the matching sections once both the
  // document has rendered and the captures are ready. applyPriorCapturesToHost
  // looks captures up by absolute index, so passing the full index list only
  // overlays the signed sections and leaves the rest as the edited content.
  useEffect(() => {
    if (renderedPages.length === 0 || signedCaptures.length === 0) return;
    const host = renderedPages[0].closest(
      ".docx-preview-host"
    ) as HTMLElement | null;
    if (!host) return;
    const allIndices = renderedPages.map((_, i) => i);
    applyPriorCapturesToHost(host, allIndices, signedCaptures);
  }, [renderedPages, signedCaptures]);

  const handlePagesReady = useCallback((pages: HTMLElement[]) => {
    setRenderedPages(pages);
  }, []);

  const canSubmit = Boolean(
    filingCase &&
      bundle &&
      bundle.orderedDocuments.length > 0
  );

  // A tehsil can only be set while the case is still editable (draft/returned);
  // the backend locks submitted/accepted cases. effectiveTehsil prefers the
  // lawyer's unsaved pick, otherwise the value saved on the case.
  const isCaseEditable =
    !backendCase ||
    backendCase.status === "draft" ||
    backendCase.status === "returned";
  const effectiveTehsil = tehsilDraft ?? backendCase?.assignedTehsil ?? "";

  const syncWorkspaceBundle = useCallback(() => {
    if (!selectedCaseId) return;

    useDocumentEditorStore.getState().loadDraft(selectedCaseId);
    const editorState = useDocumentEditorStore.getState();
    const editorItems = editorState.bundleItems.map((item) => {
      const attachment = editorState.attachmentsById[item.refId];
      return {
        bundleItemId: item.id,
        sourceRefId: item.refId,
        title: item.title,
        type: item.type,
        attachmentType: attachment?.type,
      };
    });

    const derivedTitle = getCaseDisplayTitle(filingCase?.title, selectedCaseId);

    ensureCaseContext(selectedCaseId, derivedTitle);
    // Phase 1: the new signature_requests shape doesn't match the
    // submission-bundle's legacy SignatureRequestInput (bundleItemId,
    // requiresClient*, etc). Pass an empty list; Phase 2 will rebuild
    // the linkage once cases.signed_pdf is wired.
    refreshBundleFromWorkspace(selectedCaseId, editorItems, []);
  }, [ensureCaseContext, filingCase?.title, refreshBundleFromWorkspace, selectedCaseId]);

  useEffect(() => {
    if (!selectedCaseId) return;
    syncWorkspaceBundle();
  }, [selectedCaseId, syncWorkspaceBundle]);

  const handleDownloadBundle = async () => {
    const latestCase = getCaseById(selectedCaseId);
    if (!latestCase) return;

    const result = mockDownloadBundle(selectedCaseId);
    if (!result.ok) {
      setFeedback({
        tone: "error",
        message: result.error || "Unable to download case bundle.",
      });
      return;
    }

    useDocumentEditorStore.getState().loadDraft(selectedCaseId);
    const editorState = useDocumentEditorStore.getState();

    const {
      bundleItems,
      documentsById,
      attachmentsById,
      attachments,
      documentContents,
      currentDocId,
      activeEditorRef,
    } = editorState;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setFeedback({
        tone: "error",
        message: "Popup blocked. Please allow popups to download the case file.",
      });
      return;
    }

    const getAttachment = (attachmentId: string) =>
      attachmentsById[attachmentId] ||
      attachments.find((attachment) => attachment.id === attachmentId);

    const collectImageAttachmentIds = (
      content: JSONContent | null | undefined,
      bucket: Set<string>
    ) => {
      if (!content) return;
      const walk = (node: JSONContent) => {
        const isImageAttachment =
          node.type === "imageAttachment" ||
          (node.type === "attachmentBlock" &&
            typeof node.attrs?.mimeType === "string" &&
            node.attrs.mimeType.includes("image"));
        if (isImageAttachment && node.attrs?.attachmentId) {
          bucket.add(String(node.attrs.attachmentId));
        }
        if (node.content) node.content.forEach((child) => walk(child));
      };
      walk(content);
    };

    const collectImageAttachmentIdsFromHtml = (
      html: string,
      bucket: Set<string>
    ) => {
      if (typeof DOMParser === "undefined") return;
      const parsed = new DOMParser().parseFromString(html, "text/html");
      parsed
        .querySelectorAll("[data-image-attachment][data-attachment-id]")
        .forEach((node) => {
          const id = node.getAttribute("data-attachment-id");
          if (id) bucket.add(id);
        });

      parsed
        .querySelectorAll("[data-attachment-block][data-attachment-id][data-mime-type]")
        .forEach((node) => {
          const mime = node.getAttribute("data-mime-type") || "";
          if (!mime.includes("image")) return;
          const id = node.getAttribute("data-attachment-id");
          if (id) bucket.add(id);
        });
    };

    const resolveDocHtmlAsync = async (docId: string) => {
      if (docId === currentDocId && activeEditorRef) {
        return activeEditorRef.getHTML();
      }
      const doc = documentsById[docId];
      if (doc?.contentJSON) {
        return generateHTML(doc.contentJSON as JSONContent, exportExtensions);
      }
      if (doc?.legacyHtml) return doc.legacyHtml;
      if (documentContents[docId]) return documentContents[docId];
      if (!doc?.url) return "<p></p>";

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(resolveTemplateUrl(doc.url), {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const converted = await mammoth.convertToHtml({ arrayBuffer });
        return converted.value || "<p></p>";
      } catch {
        return "<p></p>";
      }
    };

    const embeddedImageIds = new Set<string>();
    if (currentDocId && activeEditorRef) {
      collectImageAttachmentIds(activeEditorRef.getJSON() as JSONContent, embeddedImageIds);
    }
    bundleItems.forEach((item) => {
      if (item.type !== "DOC") return;
      const doc = documentsById[item.refId];
      if (doc?.contentJSON) {
        collectImageAttachmentIds(doc.contentJSON, embeddedImageIds);
        return;
      }
      if (doc?.legacyHtml) {
        collectImageAttachmentIdsFromHtml(doc.legacyHtml, embeddedImageIds);
        return;
      }
      if (documentContents[item.refId]) {
        collectImageAttachmentIdsFromHtml(documentContents[item.refId], embeddedImageIds);
      }
    });

    const docHtmlById = new Map<string, string>();
    for (const item of bundleItems) {
      if (item.type !== "DOC") continue;
      const html = await resolveDocHtmlAsync(item.refId);
      docHtmlById.set(item.refId, html);
    }

    const sections: string[] = [];
    for (const item of bundleItems) {
      if (item.type === "DOC") {
        const html = docHtmlById.get(item.refId) || "<p></p>";
        sections.push(`
          <div style="page-break-after: always;">
            ${html}
          </div>
        `);
        continue;
      }

      const attachment = getAttachment(item.refId);
      if (!attachment) continue;
      const isImage = attachment.type.startsWith("image/");
      const isPdf = attachment.type.includes("pdf");
      if (isImage && embeddedImageIds.has(attachment.id)) continue;

      if (isImage) {
        sections.push(`
          <div style="page-break-after: always;">
            <img src="${attachment.url}" alt="${attachment.name}" style="max-width: 100%; height: auto;" />
          </div>
        `);
        continue;
      }

      if (isPdf) {
        const pages = await renderPdfPagesToDataUrls(attachment.url);
        pages.forEach((pageDataUrl, pageIndex) => {
          sections.push(`
            <div style="page-break-after: always;">
              <img src="${pageDataUrl}" alt="${attachment.name} page ${pageIndex + 1}" style="max-width: 100%; height: auto;" />
            </div>
          `);
        });
        continue;
      }

      sections.push(`
        <div style="page-break-after: always;">
          <p>${attachment.name}</p>
        </div>
      `);
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Complete Case File - ${latestCase.title}</title>
          <style>
            body {
              font-family: 'Times New Roman', serif;
              line-height: 1.6;
              max-width: 8.5in;
              margin: 0 auto;
              padding: 1in;
              color: #000;
            }
            table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
            th, td { border: 1px solid #000; padding: 6pt; text-align: left; }
            figure.image-attachment-wrapper { margin: 16pt 0; }
            figure.image-attachment-wrapper img { max-width: 100%; height: auto; display: block; }
            @media print { body { margin: 0; padding: 1in; } }
          </style>
        </head>
        <body>${sections.join("")}</body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);

    setFeedback({ tone: "info", message: "Complete case file download started." });
  };

  const handleConfirmSubmission = () => {
    setTechnicalError(undefined);
    setFeedback(null);
    submitMutation.mutate(selectedCaseId);
  };

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle="Case Filing Submission">
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/30 to-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Submit Case File
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-gray-900">
                Complete Case File Checklist
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Review included documents in the final PDF bundle, then submit to registrar.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Case: {displayCaseTitle}
              </p>
            </div>
          </div>
        </div>

        {filingCase && bundle && (
          <>
            {/* Complete case-file preview — the full edited document (every
                section, rendered from cases.edited_html, NOT the blank
                template), shown read-only. Signed sections are overlaid with
                their signed capture (pulled back out of the compiled
                signed.pdf) so the registrar-bound file reads exactly as it
                will be sent. Preview only: not editable, no drop / context
                menu. */}
            <div className="rounded-xl border border-emerald-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {signedPdfStoragePath ? "Signed Case File" : "Case File"}
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-gray-900">
                    Complete Case File — Preview
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {signedPdfStoragePath && backendCase?.signedPdfGeneratedAt
                      ? `All sections in order, signed pages included · Compiled ${formatFilingDateTime(
                          backendCase.signedPdfGeneratedAt
                        )}`
                      : "All sections in order, with your latest edits."}
                  </p>
                </div>
              </div>

              {signedPdfError && (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {signedPdfError}
                </div>
              )}

              <div className="mt-4 h-[70vh] overflow-hidden rounded-lg border border-gray-200">
                {backendCase && !backendCase.editedHtml ? (
                  <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-500">
                    No edited document yet. Open the editor and make changes to
                    build the case file.
                  </div>
                ) : (
                  <DocxPreviewSurface
                    arrayBuffer={null}
                    editedHtml={backendCase?.editedHtml ?? null}
                    isLoading={backendCaseLoading}
                    editable={false}
                    onPagesReady={handlePagesReady}
                  />
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-900">
                  Documents Included in Complete PDF Case File
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {bundle.orderedDocuments.length} document{bundle.orderedDocuments.length === 1 ? "" : "s"}
                </span>
              </div>

              <p className="mt-1 text-xs text-gray-500">
                Updated {formatFilingDateTime(bundle.generatedAt)}
              </p>

              {bundle.orderedDocuments.length === 0 ? (
                <div className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                  No documents found in this case bundle yet.
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {bundle.orderedDocuments.map((doc, index) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-[#f8fafc] px-4 py-3 text-sm"
                    >
                      <div className="flex items-start gap-3">
                        {doc.source === "evidence" ? (
                          <Paperclip className="mt-0.5 h-4 w-4 text-gray-500" />
                        ) : (
                          <FileText className="mt-0.5 h-4 w-4 text-blue-600" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">
                            {index + 1}. {doc.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {doc.source === "evidence"
                              ? "Attachment"
                              : "Prepared Document"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.signedRequired && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              doc.signedCompleted
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {doc.signedCompleted ? "Signed" : "Signature Pending"}
                          </span>
                        )}
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                          Included
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Registrar return reason — shown when the backend reports the
                case was sent back. The lawyer addresses this, re-opens the
                editor to fix the file, then resubmits with the same flow. */}
            {backendCase?.status === "returned" && (
              <div className="rounded-xl border-l-4 border-red-500 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-red-900">
                      Returned by the registrar — reason for return
                    </p>
                    <p className="text-sm leading-relaxed text-red-800">
                      {backendCase.reviewRemarks?.trim() ||
                        "The registrar returned this case without a written reason. Please contact them for details."}
                    </p>
                    {backendCase.reviewedAt && (
                      <p className="text-xs text-red-700">
                        Returned on {formatFilingDateTime(backendCase.reviewedAt)}
                      </p>
                    )}
                    <p className="pt-1 text-xs text-red-700">
                      Open the editor to fix the file, then submit again below.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Court / tehsil (jurisdiction). Routes the case to the matching
                registrar and is required before submission. Editable while the
                case is a draft or returned; older cases created before tehsil
                routing have none and can assign it right here. */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-base font-semibold text-gray-900">
                Court / Tehsil (Jurisdiction)
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Routes this case to the registrar for that tehsil. Required
                before you can submit.
              </p>

              {isCaseEditable ? (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">
                      Assigned tehsil
                    </label>
                    <select
                      value={effectiveTehsil}
                      onChange={(event) => setTehsilDraft(event.target.value)}
                      disabled={saveTehsilMutation.isPending}
                      className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01411C] disabled:bg-gray-100"
                    >
                      <option value="">— Select court / tehsil —</option>
                      {SUPPORTED_TEHSILS.map((tehsil) => (
                        <option key={tehsil} value={tehsil}>
                          {tehsil}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => saveTehsilMutation.mutate(effectiveTehsil)}
                    disabled={
                      saveTehsilMutation.isPending ||
                      !effectiveTehsil ||
                      effectiveTehsil === (backendCase?.assignedTehsil ?? "")
                    }
                    className="rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23] disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {saveTehsilMutation.isPending ? "Saving…" : "Save tehsil"}
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-sm font-medium text-gray-900">
                  {backendCase?.assignedTehsil ?? "Not assigned"}
                </p>
              )}

              {isCaseEditable && !backendCase?.assignedTehsil && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  No tehsil set yet — pick one and save before submitting.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Submission Actions
                  </h3>
                  {backendCase?.status === "submitted" && backendCase.submittedAt && (
                    <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Submitted on {formatFilingDateTime(backendCase.submittedAt)}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    void handleDownloadBundle();
                  }}
                  disabled={bundle.orderedDocuments.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  Download Complete PDF
                </button>
                <button
                  onClick={() => {
                    setTechnicalError(undefined);
                    setConfirmOpen(true);
                  }}
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23] disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  <UploadCloud className="h-4 w-4" />
                  {backendCase?.status === "returned"
                    ? "Submit Corrected Case File"
                    : "Submit Case File"}
                </button>
              </div>
            </div>
          </>
        )}

        {feedback && (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              feedback.tone === "error"
                ? "border border-rose-200 bg-rose-50 text-rose-700"
                : "border border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            <div className="flex items-start gap-2">
              {feedback.tone === "error" ? (
                <AlertCircle className="mt-0.5 h-4 w-4" />
              ) : (
                <ClipboardCheck className="mt-0.5 h-4 w-4" />
              )}
              <span>{feedback.message}</span>
            </div>
          </div>
        )}
      </div>

      {filingCase && (
        <SubmitConfirmationModal
          open={confirmOpen}
          caseTitle={displayCaseTitle}
          destination={
            backendCase?.assignedTehsil
              ? `the registrar for ${backendCase.assignedTehsil}`
              : "the assigned registrar"
          }
          submitting={submitMutation.isPending}
          technicalError={technicalError}
          onCancel={() => {
            if (submitMutation.isPending) return;
            setConfirmOpen(false);
            setTechnicalError(undefined);
          }}
          onConfirm={handleConfirmSubmission}
        />
      )}

      {successModalMessage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-6 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-center text-xl font-semibold text-gray-900">
              Submission Successful
            </h3>
            <p className="mt-2 text-center text-sm text-gray-600">
              {successModalMessage}
            </p>
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setSuccessModalMessage(null)}
                className="rounded-lg bg-[#01411C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#024a23]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </LawyerLayout>
  );
}
