import {
  AlertCircle,
  CheckCircle,
  Download,
  FileText,
  Image as ImageIcon,
  MapPinned,
  Scale,
  ShieldCheck,
  UserCircle2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Document, Page, pdfjs } from "react-pdf";
import RegistrarLayout from "../components/RegistrarLayout";
import Card from "../../../shared/components/dashboard/Card";
import { getCaseDisplayTitle } from "../../../shared/utils/caseDisplay";
import { useCaseFilingStore } from "../../lawyer/store/caseFiling.store";
import {
  getFcfsSubmissionQueue,
  getProcessedCaseIdsForLatestSubmission,
} from "../utils/submissionQueue";
import { useRegistrarReviewDecisionStore } from "../store/reviewDecisions.store";
import type { CaseSubmissionRecord, SubmittedCaseFilePreviewItem } from "../../lawyer/types/caseFiling";

type ReviewPreviewItem = SubmittedCaseFilePreviewItem;

function getSignatureBadge(item: ReviewPreviewItem): {
  label: string;
  className: string;
} {
  if (item.signedByClient && item.signedByLawyer) {
    return {
      label: "Client + Lawyer Signed",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  if (item.signedByClient) {
    return {
      label: "Client Signed",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  if (item.signedByLawyer) {
    return {
      label: "Lawyer Signed",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  if (item.signedRequired && !item.signedCompleted) {
    return {
      label: "Signature Pending",
      className: "bg-amber-100 text-amber-700",
    };
  }
  if (item.signedRequired && item.signedCompleted) {
    return {
      label: "Signed",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  return {
    label: "No Signature",
    className: "bg-slate-100 text-slate-700",
  };
}

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function PdfAttachmentPreview({ dataUrl, title }: { dataUrl: string; title: string }) {
  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      setPageWidth(element.clientWidth);
    });

    observer.observe(element);
    setPageWidth(element.clientWidth);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="max-h-[720px] space-y-5 overflow-auto rounded-lg border border-gray-100 bg-gray-50 p-4">
      <Document
        file={dataUrl}
        loading={
          <div className="rounded-lg border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
            Loading PDF preview...
          </div>
        }
        onLoadSuccess={(doc) => setNumPages(doc.numPages)}
      >
        {Array.from({ length: numPages }, (_, index) => (
          <div key={`${title}-page-${index + 1}`} className="mx-auto w-full max-w-[980px] rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
            <Page
              pageNumber={index + 1}
              width={pageWidth ? Math.max(320, pageWidth - 40) : undefined}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </div>
        ))}
      </Document>
    </div>
  );
}

function buildFallbackPreviewItems(caseData: CaseSubmissionRecord): ReviewPreviewItem[] {
  const docItems: ReviewPreviewItem[] = caseData.bundle.orderedDocuments.map((doc) => ({
    id: doc.id,
    title: doc.title,
    type: doc.source === "evidence" ? "ATTACHMENT" : "DOC",
    source: doc.source,
    signedRequired: doc.signedRequired,
    signedCompleted: doc.signedCompleted,
    mimeType: doc.fileType === "image" ? "image/*" : doc.fileType === "pdf" ? "application/pdf" : "text/html",
  }));

  const evidenceItems: ReviewPreviewItem[] = caseData.bundle.evidenceFiles
    .filter((file) => !docItems.some((item) => item.title === file.title))
    .map((file) => ({
      id: file.id,
      title: file.title,
      type: "ATTACHMENT",
      source: "evidence",
      signedRequired: false,
      signedCompleted: false,
      mimeType: file.fileType === "image" ? "image/*" : file.fileType === "pdf" ? "application/pdf" : "application/octet-stream",
    }));

  return [...docItems, ...evidenceItems];
}

async function renderPdfAttachmentPages(dataUrl: string): Promise<string[]> {
  const pdf = await pdfjs.getDocument({ data: dataUrlToBytes(dataUrl) }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) continue;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    pages.push(canvas.toDataURL("image/png"));
  }

  return pages;
}

async function openCompleteCaseFileForDownload(caseTitle: string, items: ReviewPreviewItem[]) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    return { ok: false, error: "Popup blocked. Please allow popups to download the complete case file." };
  }

  const sectionParts: string[] = [];
  for (const item of items) {
    if (item.type === "DOC") {
      sectionParts.push(`
        <section class="section page-break">
          <h2>${item.title}</h2>
          ${item.htmlContent || "<p>Document preview not available in this submission snapshot.</p>"}
        </section>
      `);
      continue;
    }

    const mimeType = item.mimeType || "";
    if (mimeType.includes("image") && item.dataUrl) {
      sectionParts.push(`
        <section class="section page-break">
          <h2>${item.title}</h2>
          <img src="${item.dataUrl}" alt="${item.title}" />
        </section>
      `);
      continue;
    }

    if (mimeType.includes("pdf") && item.dataUrl) {
      const pages = await renderPdfAttachmentPages(item.dataUrl);
      if (!pages.length) {
        sectionParts.push(`
          <section class="section page-break">
            <h2>${item.title}</h2>
            <p>PDF preview could not be rendered for download.</p>
          </section>
        `);
      } else {
        pages.forEach((pageImage, pageIndex) => {
          sectionParts.push(`
            <section class="section page-break">
              <h2>${item.title}${pages.length > 1 ? ` - Page ${pageIndex + 1}` : ""}</h2>
              <img src="${pageImage}" alt="${item.title}" />
            </section>
          `);
        });
      }
      continue;
    }

    if (item.dataUrl) {
      sectionParts.push(`
        <section class="section page-break">
          <h2>${item.title}</h2>
          <p>File included in submitted case bundle.</p>
        </section>
      `);
      continue;
    }

    sectionParts.push(`
      <section class="section page-break">
        <h2>${item.title}</h2>
        <p>Preview not available for this file in current submission snapshot.</p>
      </section>
    `);
  }

  const sections = sectionParts.join("\n");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Complete Case File - ${caseTitle}</title>
        <style>
          body { font-family: 'Times New Roman', serif; margin: 0; padding: 0.8in; color: #111827; }
          .header { margin-bottom: 18px; border: 1px solid #d1fae5; background: #ecfdf5; padding: 12px 14px; border-radius: 10px; }
          .header h1 { margin: 0; font-size: 20px; color: #065f46; }
          .header p { margin: 6px 0 0; font-size: 12px; color: #047857; }
          .section { margin-bottom: 18px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #fff; }
          .section h2 { margin: 0 0 10px; font-size: 16px; }
          img { max-width: 100%; height: auto; }
          iframe { width: 100%; min-height: 760px; border: 1px solid #d1d5db; }
          table { border-collapse: collapse; width: 100%; margin: 10px 0; }
          th, td { border: 1px solid #111827; padding: 6px; text-align: left; }
          @media print {
            body { padding: 0.6in; }
            .page-break { page-break-after: always; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Complete Case File</h1>
          <p>${caseTitle}</p>
        </div>
        ${sections}
      </body>
    </html>
  `);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);

  return { ok: true };
}

export default function ReviewCases() {
  const navigate = useNavigate();
  const { caseId } = useParams({ from: "/review-cases/$caseId" });
  const [action, setAction] = useState<"approve" | "return" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [viewerFeedback, setViewerFeedback] = useState<string | null>(null);
  const [selectedPreviewItemId, setSelectedPreviewItemId] = useState<string>("");

  const liveSubmittedCases = useCaseFilingStore((state) =>
    state.getSubmittedCasesForRegistrar()
  );
  const decisionsByCaseId = useRegistrarReviewDecisionStore(
    (state) => state.decisionsByCaseId
  );
  const markCaseReturned = useRegistrarReviewDecisionStore(
    (state) => state.markCaseReturned
  );
  const markCaseApproved = useRegistrarReviewDecisionStore(
    (state) => state.markCaseApproved
  );

  const fullQueue = getFcfsSubmissionQueue(liveSubmittedCases);
  const excludedCaseIds = useMemo(
    () => getProcessedCaseIdsForLatestSubmission(fullQueue, decisionsByCaseId),
    [fullQueue, decisionsByCaseId]
  );
  const pendingQueue = fullQueue.filter((item) => !excludedCaseIds.has(item.caseId));
  const allSubmittedCases = getFcfsSubmissionQueue(liveSubmittedCases);
  const caseData = allSubmittedCases.find((item) => item.caseId === caseId);

  const previewItems = useMemo(() => {
    if (!caseData) return [] as ReviewPreviewItem[];
    if (caseData.submittedPreview?.items?.length) {
      return caseData.submittedPreview.items;
    }
    return buildFallbackPreviewItems(caseData);
  }, [caseData]);

  const effectiveSelectedPreviewItemId =
    previewItems.some((item) => item.id === selectedPreviewItemId)
      ? selectedPreviewItemId
      : previewItems[0]?.id || "";

  const selectedPreviewItem =
    previewItems.find((item) => item.id === effectiveSelectedPreviewItemId) ||
    previewItems[0];
  const caseTitleDisplay = getCaseDisplayTitle(caseData?.title, caseData?.caseId);
  const signedDocumentsCount = previewItems.filter((item) => {
    const badge = getSignatureBadge(item).label;
    return badge.includes("Signed");
  }).length;

  if (!caseData) {
    return (
      <RegistrarLayout pageSubtitle="Review Case">
        <div className="p-10 text-center text-gray-600">Case not found in registrar queue.</div>
      </RegistrarLayout>
    );
  }

  const handleConfirmApproval = () => {
    markCaseApproved({ caseData });
    navigate({ to: "/schedule-hearing/$caseId", params: { caseId: caseData.caseId } });
  };

  const handleDownloadCompleteFile = async () => {
    const result = await openCompleteCaseFileForDownload(caseTitleDisplay, previewItems);
    if (!result.ok) {
      setViewerFeedback(result.error || "Unable to download complete case file right now.");
      return;
    }
    setViewerFeedback("Complete case file download started.");
  };

  const renderPreviewPane = () => {
    if (!selectedPreviewItem) {
      return (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
          No submitted document preview available.
        </div>
      );
    }

    if (selectedPreviewItem.type === "DOC") {
      return (
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_20px_45px_-35px_rgba(6,95,70,0.35)]">
          <h4 className="mb-3 text-base font-semibold text-gray-900">{selectedPreviewItem.title}</h4>
          <div className="max-h-[700px] overflow-auto rounded-xl border border-emerald-100/70 bg-white p-4">
            {selectedPreviewItem.htmlContent ? (
              <div
                className="prose max-w-none prose-headings:font-semibold prose-p:leading-7"
                dangerouslySetInnerHTML={{ __html: selectedPreviewItem.htmlContent }}
              />
            ) : (
              <p className="text-sm text-gray-500">
                This document was submitted without inline HTML preview content.
              </p>
            )}
          </div>
        </div>
      );
    }

    const mimeType = selectedPreviewItem.mimeType || "";

    if (mimeType.includes("image") && selectedPreviewItem.dataUrl) {
      return (
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_20px_45px_-35px_rgba(6,95,70,0.35)]">
          <h4 className="mb-3 text-base font-semibold text-gray-900">{selectedPreviewItem.title}</h4>
          <div className="rounded-xl border border-emerald-100/70 bg-emerald-50/20 p-4">
            <img
              src={selectedPreviewItem.dataUrl}
              alt={selectedPreviewItem.title}
              className="max-h-[640px] w-full object-contain"
            />
          </div>
        </div>
      );
    }

    if (mimeType.includes("pdf") && selectedPreviewItem.dataUrl) {
      return (
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_20px_45px_-35px_rgba(6,95,70,0.35)]">
          <h4 className="mb-3 text-base font-semibold text-gray-900">{selectedPreviewItem.title}</h4>
          <PdfAttachmentPreview
            dataUrl={selectedPreviewItem.dataUrl}
            title={selectedPreviewItem.title}
          />
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_20px_45px_-35px_rgba(6,95,70,0.35)]">
        <h4 className="mb-3 text-base font-semibold text-gray-900">{selectedPreviewItem.title}</h4>
        <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/30 p-6 text-sm text-gray-500">
          Preview is unavailable for this attachment in the submitted snapshot.
        </div>
      </div>
    );
  };

  return (
    <RegistrarLayout pageSubtitle="Review Case" notificationBadge={pendingQueue.length}>
      <div className="mx-auto w-full max-w-[1680px] space-y-6 px-2">
        <Card className="border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/35 to-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                Registrar Review
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-gray-900">{caseTitleDisplay}</h2>
              <p className="mt-1 text-sm text-gray-600">
                Review submitted bundle, inspect signatures, then approve or return for corrections.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                Pending Review
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                {signedDocumentsCount} Signed Documents
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
                {caseData.submittedBy}
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
                {caseData.caseType}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Tehsil</p>
              <p className="mt-1 inline-flex items-center gap-2 font-semibold text-gray-900">
                <MapPinned className="h-4 w-4 text-emerald-700" />
                {caseData.tehsil}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Submitted At</p>
              <p className="mt-1 inline-flex items-center gap-2 font-semibold text-gray-900">
                <AlertCircle className="h-4 w-4 text-emerald-700" />
                {new Date(caseData.submittedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="border border-emerald-100">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                Submitted Case File Preview
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Browse documents one-by-one before recording your decision.
              </p>
            </div>
            <button
              onClick={() => {
                void handleDownloadCompleteFile();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#025a27]"
            >
              <Download className="h-3.5 w-3.5" />
              Download Complete Case File
            </button>
          </div>

          <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Registrar can review each submitted document one-by-one before final decision.
          </div>

          <div className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/30 p-3">
              <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Documents ({previewItems.length})
              </p>
              <div className="max-h-[760px] space-y-2 overflow-y-auto pr-1">
                {previewItems.map((item, index) => {
                  const isActive = item.id === selectedPreviewItem?.id;
                  const badge = getSignatureBadge(item);
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedPreviewItemId(item.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        isActive
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {item.type === "ATTACHMENT" ? (
                          <ImageIcon className="mt-0.5 h-4 w-4 text-gray-500" />
                        ) : (
                          <FileText className="mt-0.5 h-4 w-4 text-[#01411C]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-semibold text-gray-800">
                            {index + 1}. {item.title}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div>{renderPreviewPane()}</div>
          </div>

          {viewerFeedback && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              {viewerFeedback}
            </div>
          )}
        </Card>

        <Card className="border border-emerald-100">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
            Review Decision
          </h2>

          {!action ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
                <h3 className="text-base font-semibold text-gray-900">Approve Case</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Mark this submission as complete and proceed to hearing scheduling.
                </p>
                <button
                  onClick={() => setAction("approve")}
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
                  onClick={() => setAction("return")}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  <XCircle className="h-4 w-4" />
                  Continue with Return
                </button>
              </div>
            </div>
          ) : action === "approve" ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Approve this case?</h3>
              <p className="mt-1 text-sm text-gray-600">
                This case will be approved and you will be redirected to schedule the hearing.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => setAction(null)}
                  className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmApproval}
                  className="rounded-lg bg-[#01411C] px-5 py-2 text-sm font-medium text-white hover:bg-[#025a27]"
                >
                  Confirm & Schedule Hearing
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-rose-700">
                Remarks for Lawyer
              </label>
              <textarea
                className="w-full rounded-xl border border-rose-200 bg-white p-3 text-sm outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-300"
                placeholder="Specify what needs to be corrected..."
                rows={4}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => setAction(null)}
                  className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    markCaseReturned({ caseData, remarks });
                    navigate({ to: "/return-case" });
                  }}
                  disabled={!remarks.trim()}
                  className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Submit & Return Case
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </RegistrarLayout>
  );
}
