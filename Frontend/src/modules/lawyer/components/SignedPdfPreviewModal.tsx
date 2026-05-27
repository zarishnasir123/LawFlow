import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Download, FileCheck2, Loader2, X } from "lucide-react";

import {
  signaturesApi,
  getSignaturesErrorMessage,
} from "../signatures/api/signatures.api";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type Props = {
  caseId: string;
  caseTitle: string;
  // ISO timestamp from cases.signedPdfGeneratedAt — shown in the header so
  // the lawyer can confirm they're looking at the latest compile.
  compiledAt?: string | null;
  onClose: () => void;
};

// In-place verifier for the lawyer's signed PDFs. Opens over the
// /lawyer-signatures page so the lawyer can flip through the
// signature-stamped document without losing their tracker context
// (the previous flow navigated to /lawyer-submit-case, which dragged
// in the registrar-submission UI).
//
// Mirrors the react-pdf setup on LawyerCaseFilingSubmissionPage: fresh
// 5-min signed URL minted on open, ResizeObserver-driven page width so
// pages stay legible without horizontal scroll, no text/annotation
// layers (we only need a visual review).
export default function SignedPdfPreviewModal({
  caseId,
  caseTitle,
  compiledAt,
  onClose,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(null);
    setNumPages(0);
    (async () => {
      try {
        const { downloadUrl } = await signaturesApi.downloadSignedPdf(caseId);
        if (cancelled) return;
        setUrl(downloadUrl);
      } catch (err) {
        if (cancelled) return;
        setError(getSignaturesErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const w = el.clientWidth;
      setContainerWidth((prev) => (Math.abs(prev - w) > 2 ? w : prev));
    });
    observer.observe(el);
    setContainerWidth(el.clientWidth);
    return () => observer.disconnect();
  }, [url]);

  const pages = useMemo(
    () =>
      numPages > 0 && containerWidth > 0
        ? Array.from({ length: numPages }, (_, i) => i + 1)
        : [],
    [numPages, containerWidth]
  );

  const handleDownload = () => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const compiledLabel = compiledAt
    ? new Date(compiledAt).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-white px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <FileCheck2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Signed PDF preview
              </p>
              <h2 className="mt-0.5 truncate text-base font-semibold text-gray-900">
                {caseTitle}
              </h2>
              {compiledLabel && (
                <p className="mt-0.5 text-xs text-gray-500">
                  Compiled {compiledLabel}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!url}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 p-4"
        >
          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : !url ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing signed PDF preview…
            </div>
          ) : (
            <Document
              file={url}
              onLoadSuccess={(doc) => setNumPages(doc.numPages)}
              onLoadError={(err) => setError(err.message)}
              loading={
                <div className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading signed PDF…
                </div>
              }
            >
              {pages.map((pageNumber) => (
                <div
                  key={`signed-pdf-modal-page-${pageNumber}`}
                  className="mx-auto mb-4 w-full bg-white shadow-sm last:mb-0"
                >
                  <Page
                    pageNumber={pageNumber}
                    width={Math.max(containerWidth - 32, 320)}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </div>
              ))}
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
