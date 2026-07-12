import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Paperclip,
  Printer,
  UploadCloud,
} from "lucide-react";
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
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setFeedback({
        tone: "error",
        message: "Popup blocked. Please allow popups to print the case file.",
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

    printWindow.document.write(
      `<!doctype html><html><head><meta charset="utf-8" />` +
        `<title>Complete Case File</title><style>` +
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
        `</style>${styleHtml}</head><body>${bodyHtml}</body></html>`
    );
    printWindow.document.close();

    // Don't open the print dialog until images (attachments + signed-page
    // captures) have loaded, or the printout comes out blank/partial.
    const images = Array.from(printWindow.document.images);
    let remaining = images.filter((img) => !img.complete).length;
    const fire = () => {
      printWindow.focus();
      printWindow.print();
    };
    if (remaining === 0) {
      window.setTimeout(fire, 200);
    } else {
      images.forEach((img) => {
        if (img.complete) return;
        const done = () => {
          remaining -= 1;
          if (remaining <= 0) fire();
        };
        img.addEventListener("load", done);
        img.addEventListener("error", done);
      });
      // Safety net: print anyway after 5s if an image never resolves.
      window.setTimeout(() => {
        if (remaining > 0) {
          remaining = 0;
          fire();
        }
      }, 5000);
    }

    setFeedback({ tone: "info", message: "Opening the print dialog…" });
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
                    attachmentUrlMap={attachmentUrlMap}
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

            {/* Court / tehsil (jurisdiction). Normally chosen at case creation,
                so it's shown read-only here. The picker only appears as a
                rescue for cases that have no tehsil yet (e.g. created before
                tehsil routing existed) so they can still be submitted. */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-base font-semibold text-gray-900">
                Court / Tehsil (Jurisdiction)
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Routes this case to the registrar for that tehsil.
              </p>

              {backendCase?.assignedTehsil ? (
                <p className="mt-3 text-sm font-medium text-gray-900">
                  {backendCase.assignedTehsil}
                </p>
              ) : isCaseEditable ? (
                <>
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
                      disabled={saveTehsilMutation.isPending || !effectiveTehsil}
                      className="rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23] disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {saveTehsilMutation.isPending ? "Saving…" : "Save tehsil"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    No tehsil set yet — pick one and save before submitting.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm font-medium text-gray-900">
                  Not assigned
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
                  onClick={handlePrintBundle}
                  disabled={bundle.orderedDocuments.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Printer className="h-4 w-4" />
                  Print Complete PDF
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
                  {submitButtonLabel}
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
