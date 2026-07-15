import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Printer,
  UploadCloud,
} from "lucide-react";
import { pdfjs } from "react-pdf";
import { casesApi, getCasesErrorMessage, SUPPORTED_TEHSILS } from "../api/cases.api";
import { signaturesApi, getSignaturesErrorMessage } from "../signatures/api/signatures.api";
import LawyerLayout from "../components/LawyerLayout";
import DocxPreviewSurface from "../components/documentEditor/DocxPreviewSurface";
import { applyPriorCapturesToHost } from "../utils/capturePages";
import { derivePageLabel } from "../utils/pageLabel";
import { deriveSignatureBadge } from "../utils/pageSignatures";
import type { SignedPageCapture } from "../../../shared/api/mySignatures.api";
import { useDocumentEditorStore } from "../store/documentEditor.store";
import SubmitConfirmationModal from "../components/caseFiling/SubmitConfirmationModal";
import { useCaseFilingStore } from "../store/caseFiling.store";
import { formatFilingDateTime } from "../utils/caseFiling.utils";
import { getCaseDisplayTitle } from "../../../shared/utils/caseDisplay";
import { printHtmlDocument } from "../../../shared/utils/printHtml";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();


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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    ensureCaseContext,
    getCaseById,
    getBundleByCaseId,
    refreshBundleFromWorkspace,
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

  // attachmentId → fresh signed URL for this case's uploads. The edited_html
  // snapshot's inline-image srcs are the signed URLs from whenever the lawyer
  // last saved — they expire after an hour, so re-opening this preview later
  // would render broken images. DocxPreviewSurface rewrites each floating
  // image's src from this map (same mechanism the editor uses on case open).
  const { data: caseAttachments } = useQuery({
    queryKey: ["case", selectedCaseId, "attachments"],
    queryFn: () => casesApi.listAttachments(selectedCaseId),
    enabled: Boolean(selectedCaseId) && selectedCaseId !== "default-case",
    staleTime: 0,
    refetchOnMount: "always",
  });
  const attachmentUrlMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const attachment of caseAttachments ?? []) {
      if (attachment.url) map[attachment.id] = attachment.url;
    }
    return map;
  }, [caseAttachments]);

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

  // Signing status grouped BY PAGE — same shape + badge the editor's page
  // sidebar uses. For each page with signature activity we track which signers
  // have signed it and whether one is still pending, and name it by its
  // rendered section title (falling back to "Page N" until the preview loads).
  const signaturePageRows = useMemo(() => {
    const byPage = new Map<
      number,
      { clientSigned: boolean; lawyerSigned: boolean; pending: boolean }
    >();
    for (const r of signatureData?.signatureRequests ?? []) {
      if (r.status !== "signed" && r.status !== "pending") continue;
      for (const idx of r.pageIndices ?? []) {
        const cur =
          byPage.get(idx) ??
          { clientSigned: false, lawyerSigned: false, pending: false };
        if (r.status === "signed") {
          if (r.signerRole === "client") cur.clientSigned = true;
          else cur.lawyerSigned = true;
        } else {
          cur.pending = true;
        }
        byPage.set(idx, cur);
      }
    }
    const labelFor = (idx: number) => {
      const el = renderedPages[idx];
      return el ? derivePageLabel(el, `Page ${idx + 1}`) : `Page ${idx + 1}`;
    };
    return Array.from(byPage.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([idx, status]) => ({ idx, label: labelFor(idx), status }));
  }, [signatureData, renderedPages]);

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

  // A case can be submitted / edited only while it's a draft or returned; the
  // backend locks submitted and accepted cases. Once submitted, the Submit
  // button stays disabled until the registrar returns the case.
  const isCaseEditable =
    !backendCase ||
    backendCase.status === "draft" ||
    backendCase.status === "returned";
  const effectiveTehsil = tehsilDraft ?? backendCase?.assignedTehsil ?? "";

  const canSubmit = Boolean(
    filingCase &&
      bundle &&
      bundle.orderedDocuments.length > 0 &&
      isCaseEditable
  );

  // The Submit button doubles as a status indicator: it's disabled (via
  // canSubmit) for submitted/accepted cases and the label says why.
  const submitButtonLabel =
    backendCase?.status === "submitted"
      ? "Awaiting Registrar Review"
      : backendCase?.status === "accepted"
        ? "Accepted by Registrar"
        : backendCase?.status === "returned"
          ? "Submit Corrected Case File"
          : "Submit Case File";

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

  // Print the COMPLETE case file exactly as shown in the preview above — the
  // full rendered document (all sections) with the signed-page captures already
  // overlaid. We clone the live preview host into a print window, so what prints
  // is precisely what the lawyer reviewed. (The old "download" path ran on the
  // dead mock editor store and produced nothing.)
  const handlePrintBundle = () => {
    const host = renderedPages[0]?.closest(
      ".docx-preview-host"
    ) as HTMLElement | null;
    if (!host) {
      setFeedback({
        tone: "error",
        message:
          "The case file isn't ready to print yet — wait for the preview to load.",
      });
      return;
    }
    // docx-preview keeps its per-document page styles in <style> tags inside the
    // host; carry them over so the print matches the on-screen pages.
    const styleHtml = Array.from(host.querySelectorAll("style"))
      .map((s) => s.outerHTML)
      .join("\n");
    const wrapper = host.querySelector(".docx-wrapper");
    const bodyHtml = wrapper ? wrapper.outerHTML : host.innerHTML;

    const printStyles =
      `<style>` +
      `body{margin:0;background:#fff;}` +
      `.docx-wrapper{background:transparent!important;padding:0!important;}` +
      `.docx-wrapper>section.docx{box-shadow:none!important;outline:none!important;border:none!important;margin:0 auto!important;overflow:hidden!important;page-break-after:always;page-break-inside:avoid;break-inside:avoid;}` +
      // Keep each A4 page on ONE sheet — without this each page's sub-pixel
      // overflow spilled onto a second, blank sheet. The last page mustn't
      // force a trailing break (which would add a final blank sheet).
      `.docx-wrapper>section.docx:last-child{page-break-after:auto!important;break-after:auto!important;}` +
      // Force the whole case file to the templates' Times New Roman so typed
      // text (party names, etc.) prints in the document font, not the
      // sans-serif fallback it picked up while being typed.
      `.docx-wrapper>section.docx,.docx-wrapper>section.docx *{font-family:'Times New Roman',Times,serif!important;}` +
      `.lawflow-resize-handle,.lawflow-image-delete{display:none!important;}` +
      `.lawflow-floating-image{outline:none!important;}` +
      `@page{margin:0;}` +
      `</style>`;

    // Print in an off-screen iframe (image-load waiting handled inside the
    // shared printer) — the case file shows only in the print dialog and no
    // stray about:blank tab lingers when the dialog is cancelled.
    const started = printHtmlDocument({
      title: "Complete Case File",
      headHtml: `${printStyles}${styleHtml}`,
      bodyHtml,
      // Clear the "Opening the print dialog…" note the moment the dialog opens,
      // so it doesn't linger on the page afterwards.
      onBeforePrint: () => setFeedback(null),
    });
    if (!started) {
      setFeedback({
        tone: "error",
        message: "Couldn't open the print dialog. Please try again.",
      });
      return;
    }

    setFeedback({ tone: "info", message: "Opening the print dialog…" });
  };

  const handleConfirmSubmission = () => {
    setTechnicalError(undefined);
    setFeedback(null);
    submitMutation.mutate(selectedCaseId);
  };

  return (
    <LawyerLayout
      brandTitle="LawFlow"
      brandSubtitle="Case Filing Submission"
      pageSubtitle={displayCaseTitle}
      showBackButton
      onBackClick={() => navigate({ to: "/lawyer-cases" })}
      backLabel="Back to cases"
      fullHeight
    >
      {!(filingCase && bundle) ? (
        // Case context still loading (or missing) — fill the shell with a
        // single centered message instead of an empty scroll.
        <div className="flex h-full items-center justify-center bg-slate-50 p-8">
          <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">
            Loading the case file…
          </div>
        </div>
      ) : (
        // Full-height split: big scrollable document preview (left) beside a
        // sticky action sidebar (right) whose Submit / Print buttons stay
        // pinned and visible. Mirrors the signing screen's workspace.
        <div className="flex h-full flex-col overflow-hidden bg-white">
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* ── Left: full-height document preview ─────────────────── */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
              {/* Slim strip naming the surface + signed status. */}
              <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/70 px-4 py-2.5">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {signedPdfStoragePath ? "Signed Case File" : "Case File"} —
                  Preview
                </span>
                <span className="text-[11px] text-gray-500">
                  {signedPdfStoragePath && backendCase?.signedPdfGeneratedAt
                    ? `Signed pages included · Compiled ${formatFilingDateTime(
                        backendCase.signedPdfGeneratedAt
                      )}`
                    : "All sections in order, with your latest edits."}
                </span>
              </div>

              {signedPdfError && (
                <div className="flex-shrink-0 border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                  {signedPdfError}
                </div>
              )}

              {/* The preview owns the ONLY scroll here — DocxPreviewSurface's
                  root is h-full overflow-auto, so it fills this cell and
                  scrolls internally (no nested h-[70vh] trap, no page scroll). */}
              <div className="relative min-h-0 flex-1 overflow-hidden">
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
                    attachmentUrlMap={attachmentUrlMap}
                    onPagesReady={handlePagesReady}
                  />
                )}
              </div>
            </div>

            {/* ── Right: sticky action sidebar (never scrolls with the doc) ── */}
            <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-white max-lg:max-h-[55dvh] lg:w-[380px] lg:flex-shrink-0 lg:border-l lg:border-t-0">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Submit Case File
                  </div>
                  <h1 className="mt-2 text-lg font-semibold text-gray-900">
                    Complete PDF Case File
                  </h1>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    Preview the full case file on the left, print it, and submit
                    it to the registrar.
                  </p>
                </div>

                {backendCase?.status === "submitted" &&
                  backendCase.submittedAt && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Submitted {formatFilingDateTime(backendCase.submittedAt)}
                    </div>
                  )}

                {/* Registrar return reason — the lawyer fixes the file in the
                    editor, then resubmits with the button below. */}
                {backendCase?.status === "returned" && (
                  <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-red-900">
                          Returned by the registrar
                        </p>
                        <p className="text-xs leading-relaxed text-red-800">
                          {backendCase.reviewRemarks?.trim() ||
                            "Returned without a written reason — contact the registrar for details."}
                        </p>
                        {backendCase.reviewedAt && (
                          <p className="text-[11px] text-red-700">
                            Returned {formatFilingDateTime(backendCase.reviewedAt)}
                          </p>
                        )}
                        <p className="pt-0.5 text-[11px] text-red-700">
                          Open the editor to fix the file, then submit again.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Court / tehsil. Read-only once set; a rescue picker appears
                    only for cases with no tehsil yet so they can still be
                    submitted. */}
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Court / Tehsil
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    The court where this case will be filed.
                  </p>

                  {backendCase?.assignedTehsil ? (
                    <p className="mt-2 text-sm font-medium text-gray-900">
                      {backendCase.assignedTehsil}
                    </p>
                  ) : isCaseEditable ? (
                    <div className="mt-2 space-y-2">
                      <select
                        value={effectiveTehsil}
                        onChange={(event) => setTehsilDraft(event.target.value)}
                        disabled={saveTehsilMutation.isPending}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01411C] disabled:bg-gray-100"
                      >
                        <option value="">— Select court / tehsil —</option>
                        {SUPPORTED_TEHSILS.map((tehsil) => (
                          <option key={tehsil} value={tehsil}>
                            {tehsil}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => saveTehsilMutation.mutate(effectiveTehsil)}
                        disabled={
                          saveTehsilMutation.isPending || !effectiveTehsil
                        }
                        className="w-full rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23] disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        {saveTehsilMutation.isPending ? "Saving…" : "Save tehsil"}
                      </button>
                      <p className="text-xs font-medium text-amber-700">
                        Pick a court and save before submitting.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm font-medium text-gray-900">
                      Not assigned
                    </p>
                  )}
                </div>

                {/* Signing status — one row per page with the same combined
                    "who signed" badge as the editor's page sidebar. */}
                {signaturePageRows.length > 0 && (
                  <div className="border-t border-gray-100 pt-4">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Signatures
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Who signed which pages.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {signaturePageRows.map((row) => {
                        const badge = deriveSignatureBadge(row.status);
                        return (
                          <li
                            key={row.idx}
                            className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
                          >
                            <p className="min-w-0 flex-1 truncate text-xs font-medium text-gray-900">
                              {row.label}
                            </p>
                            {badge ? (
                              <span
                                className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            ) : (
                              <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                                Pending
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {feedback && (
                  <div
                    className={`rounded-lg px-3 py-2 text-xs ${
                      feedback.tone === "error"
                        ? "border border-rose-200 bg-rose-50 text-rose-700"
                        : "border border-blue-200 bg-blue-50 text-blue-700"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {feedback.tone === "error" ? (
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      ) : (
                        <ClipboardCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      )}
                      <span>{feedback.message}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Pinned actions — always visible, never scroll away. */}
              <div className="flex-shrink-0 space-y-2 border-t border-slate-200 p-4">
                <button
                  onClick={() => {
                    setTechnicalError(undefined);
                    setConfirmOpen(true);
                  }}
                  disabled={!canSubmit}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#01411C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#024a23] disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  <UploadCloud className="h-4 w-4" />
                  {submitButtonLabel}
                </button>
                <button
                  onClick={handlePrintBundle}
                  disabled={bundle.orderedDocuments.length === 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Printer className="h-4 w-4" />
                  Print Complete PDF
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}

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
