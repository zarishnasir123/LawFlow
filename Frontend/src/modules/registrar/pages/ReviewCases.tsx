import {
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  MapPinned,
  Paperclip,
  Printer,
  Scale,
  ShieldCheck,
  UserCircle2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import RegistrarLayout from "../components/RegistrarLayout";
import Card from "../../../shared/components/dashboard/Card";
import { getCaseDisplayTitle } from "../../../shared/utils/caseDisplay";
// Reused read-only document renderer from the lawyer module. It is a pure
// component (no lawyer-store coupling), so importing it here to render the
// prepared-document snapshot is acceptable for this build.
import DocxPreviewSurface from "../../lawyer/components/documentEditor/DocxPreviewSurface";
// Overlay helper + rasterizer reused from the lawyer submission page so the
// registrar's complete-case-file preview shows the signatures in place exactly
// as the lawyer's does (same capture → same overlay sequence).
import { applyPriorCapturesToHost } from "../../lawyer/utils/capturePages";
import { renderPdfPagesToDataUrls } from "../../../shared/utils/pdfRaster";
import type { SignedPageCapture } from "../../../shared/api/mySignatures.api";
import { approveCase, getCase, getRegistrarErrorMessage } from "../api";

export default function ReviewCases() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { caseId } = useParams({ from: "/review-cases/$caseId" });
  const [action, setAction] = useState<"approve" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The rendered <section.docx> pages from DocxPreviewSurface (set via
  // onPagesReady) and the per-page signed captures rasterized out of the
  // signed PDF. Effect B zips them together to paint the signatures in place.
  const [renderedPages, setRenderedPages] = useState<HTMLElement[]>([]);
  const [signedCaptures, setSignedCaptures] = useState<SignedPageCapture[]>([]);

  const {
    data: caseData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["registrar", "cases", caseId],
    queryFn: () => getCase(caseId),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveCase(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrar", "cases"] });
      navigate({ to: "/view-cases" });
    },
    onError: (error) => setErrorMessage(getRegistrarErrorMessage(error)),
  });

  const signedPdfUrl = caseData?.signedPdfUrl ?? null;
  // Stable string key for the page-index list so the rasterize effect only
  // re-runs when the actual indices change, not on every caseData identity.
  const signedPageIndices = caseData?.signedPageIndices ?? [];
  const signedPageIndicesKey = signedPageIndices.join(",");

  // Effect A — rasterize the compiled signed.pdf into per-page captures keyed
  // by absolute page index. signedPdfUrl is already a ready-to-use signed URL
  // (minted server-side), so we never call any signatures API here. The signed
  // pdf contains exactly the signed pages in ascending order, so
  // signedPageIndices[i] corresponds to signed-pdf page i — we zip them.
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
      } catch {
        if (cancelled) return;
        setSignedCaptures([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // signedPageIndicesKey is the stable string form of signedPageIndices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedPdfUrl, signedPageIndicesKey]);

  // Effect B — overlay the signed captures onto the matching sections once both
  // the document has rendered and the captures are ready.
  // applyPriorCapturesToHost looks captures up by absolute index, so passing
  // the full index list only overlays the signed sections and leaves the rest
  // as the edited content.
  useEffect(() => {
    if (renderedPages.length === 0 || signedCaptures.length === 0) return;
    const host = renderedPages[0].closest(
      ".docx-preview-host"
    ) as HTMLElement | null;
    if (!host) return;
    applyPriorCapturesToHost(
      host,
      renderedPages.map((_, i) => i),
      signedCaptures
    );
  }, [renderedPages, signedCaptures]);

  if (isLoading) {
    return (
      <RegistrarLayout pageSubtitle="Review Case">
        <div className="p-10 text-center text-gray-600">Loading case…</div>
      </RegistrarLayout>
    );
  }

  if (isError || !caseData) {
    return (
      <RegistrarLayout pageSubtitle="Review Case">
        <div className="p-10 text-center text-gray-600">
          Case not found in registrar queue.
        </div>
      </RegistrarLayout>
    );
  }

  const caseTitleDisplay = getCaseDisplayTitle(caseData.title, caseData.id);
  const isMutating = approveMutation.isPending;

  const handleConfirmApproval = () => {
    setErrorMessage(null);
    approveMutation.mutate();
  };

  // Print the COMPLETE case file: the prepared document (with the signature
  // overlays already baked into the live DOM by Effect B) followed by every
  // attachment. Mirrors the lawyer's handleDownloadBundle print-window
  // mechanics — open a blank window, write a minimal print document, then
  // trigger print after a short settle delay.
  const handlePrintCompleteFile = async () => {
    setErrorMessage(null);

    // Capture the prepared document WITH the in-place signature overlays —
    // outerHTML snapshots the wrapper exactly as the registrar sees it.
    const wrapper = document.querySelector(".docx-preview-host .docx-wrapper");
    const docHtml = wrapper ? wrapper.outerHTML : "";

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setErrorMessage(
        "Popup blocked. Please allow popups to print the complete case file."
      );
      return;
    }

    // Flatten each attachment into one or more page-break sections: images go
    // straight in as <img>, PDFs are rasterized page-by-page into images.
    const attachmentSections: string[] = [];
    for (const attachment of caseData?.attachments ?? []) {
      if (!attachment.url) continue;
      const mime = attachment.mimeType || "";
      const isImage = mime.startsWith("image/");
      const isPdf = mime.includes("pdf");

      if (isImage) {
        attachmentSections.push(`
          <div style="page-break-before: always;">
            <img src="${attachment.url}" alt="${attachment.fileName}" style="max-width: 100%; display: block;" />
          </div>
        `);
        continue;
      }

      if (isPdf) {
        const pages = await renderPdfPagesToDataUrls(attachment.url);
        pages.forEach((pageDataUrl, pageIndex) => {
          attachmentSections.push(`
            <div style="page-break-before: always;">
              <img src="${pageDataUrl}" alt="${attachment.fileName} page ${pageIndex + 1}" style="max-width: 100%; display: block;" />
            </div>
          `);
        });
      }
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Complete Case File - ${caseTitleDisplay}</title>
          <style>
            @media print { body { margin: 0; } }
            img { max-width: 100%; display: block; }
          </style>
        </head>
        <body>${docHtml}${attachmentSections.join("")}</body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  return (
    <RegistrarLayout pageSubtitle="Review Case">
      <div className="mx-auto w-full max-w-[1280px] space-y-6 px-2">
        <Card className="border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/35 to-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                Registrar Review
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                {caseTitleDisplay}
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-600">
                Review the submitted case file, then approve or return for corrections.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                Pending Review
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
            Case Information
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
              <p className="text-xs text-gray-500">Case Title</p>
              <p className="mt-1 font-semibold text-gray-900">{caseTitleDisplay}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Lawyer</p>
              <p className="mt-1 inline-flex items-center gap-2 font-semibold text-gray-900">
                <UserCircle2 className="h-4 w-4 text-emerald-700" />
                {caseData.lawyerName}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Client</p>
              <p className="mt-1 inline-flex items-center gap-2 font-semibold text-gray-900">
                <UserCircle2 className="h-4 w-4 text-emerald-700" />
                {caseData.clientName}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Category</p>
              <p className="mt-1 inline-flex items-center gap-2 font-semibold capitalize text-gray-900">
                <Scale className="h-4 w-4 text-emerald-700" />
                {caseData.caseTypeLabel || caseData.category}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Tehsil</p>
              <p className="mt-1 inline-flex items-center gap-2 font-semibold text-gray-900">
                <MapPinned className="h-4 w-4 text-emerald-700" />
                {caseData.assignedTehsil || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Submitted At</p>
              <p className="mt-1 inline-flex items-center gap-2 font-semibold text-gray-900">
                <AlertCircle className="h-4 w-4 text-emerald-700" />
                {caseData.submittedAt
                  ? new Date(caseData.submittedAt).toLocaleString()
                  : "—"}
              </p>
            </div>
          </div>
        </Card>

        {/* Complete case-file preview — the full prepared document (every
            section, rendered read-only from cases.edited_html, NOT the blank
            template). The registrar reads the whole plaint here. The signed
            pages are overlaid IN PLACE: each signature capture (pulled back out
            of the compiled signed.pdf) sits on its matching section, so this
            single preview reads exactly like the file the lawyer signed. */}
        <Card className="border border-emerald-100">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
              Complete Case File — Preview
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {caseData.signedPageIndices.length > 0
                ? "Signed Case File"
                : "Prepared Document"}
            </span>
          </div>

          {caseData.editedHtml ? (
            <div className="h-[70vh] overflow-hidden rounded-xl border border-gray-200">
              <DocxPreviewSurface
                arrayBuffer={null}
                editedHtml={caseData.editedHtml}
                isLoading={false}
                editable={false}
                onPagesReady={(pages) => setRenderedPages(pages)}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 px-4 py-6 text-sm text-amber-800">
              No prepared document yet.
            </div>
          )}
        </Card>

        {/* Documents Included checklist — mirrors the lawyer's "Complete
            Case File Checklist": the one prepared document plus every
            uploaded attachment, each with a View link opening its signed
            URL in a new tab. */}
        <Card className="border border-gray-200">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
              Documents Included in Complete Case File
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {caseData.attachments.length + 1} document
              {caseData.attachments.length + 1 === 1 ? "" : "s"}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-[#f8fafc] px-4 py-3 text-sm">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 text-emerald-700" />
                <div>
                  <p className="font-medium text-gray-900">
                    {caseTitleDisplay}
                  </p>
                  <p className="text-xs text-gray-500">Prepared Document</p>
                </div>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                Included
              </span>
            </div>

            {caseData.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-[#f8fafc] px-4 py-3 text-sm"
              >
                <div className="flex items-start gap-3">
                  <Paperclip className="mt-0.5 h-4 w-4 text-gray-500" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {attachment.fileName}
                    </p>
                    <p className="text-xs text-gray-500">Attachment</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {attachment.url ? (
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View
                    </a>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      Unavailable
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border border-emerald-100">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
              Review Decision
            </h2>
            <button
              onClick={() => {
                void handlePrintCompleteFile();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#025a27]"
            >
              <Printer className="h-4 w-4" />
              Print Complete Case File
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          {!action ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
                <h3 className="text-base font-semibold text-gray-900">Approve Case</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Accept this submission so it can proceed to hearing scheduling.
                </p>
                <button
                  onClick={() => {
                    setErrorMessage(null);
                    setAction("approve");
                  }}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#01411C] py-2.5 text-sm font-semibold text-white hover:bg-[#025a27]"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Continue with Approval
                </button>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
                <h3 className="text-base font-semibold text-gray-900">Return for Corrections</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Send this case back to the lawyer with specific correction remarks.
                </p>
                <button
                  onClick={() =>
                    navigate({
                      to: "/return-case",
                      search: { caseId: caseData.id },
                    })
                  }
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  <XCircle className="h-4 w-4" />
                  Continue with Return
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Approve this case?</h3>
              <p className="mt-1 text-sm text-gray-600">
                The case will be accepted and removed from your review queue.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => setAction(null)}
                  disabled={isMutating}
                  className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmApproval}
                  disabled={isMutating}
                  className="rounded-lg bg-[#01411C] px-5 py-2 text-sm font-medium text-white hover:bg-[#025a27] disabled:opacity-50"
                >
                  {approveMutation.isPending ? "Approving…" : "Confirm Approval"}
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </RegistrarLayout>
  );
}
