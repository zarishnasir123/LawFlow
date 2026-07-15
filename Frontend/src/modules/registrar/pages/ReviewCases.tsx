import {
  ArrowLeft,
  CheckCircle2,
  Printer,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import RegistrarLayout from "../components/RegistrarLayout";
import { getCaseDisplayTitle } from "../../../shared/utils/caseDisplay";
// Reused read-only document renderer + signed-overlay/rasterize helpers from the
// lawyer module (all pure, no lawyer-store coupling) — same precedent already
// used for this preview. The page-label + signature-badge utils are shared too
// so the registrar's "who signed" badges match the editor exactly.
import DocxPreviewSurface from "../../lawyer/components/documentEditor/DocxPreviewSurface";
import { applyPriorCapturesToHost } from "../../lawyer/utils/capturePages";
import { derivePageLabel } from "../../lawyer/utils/pageLabel";
import { deriveSignatureBadge } from "../../lawyer/utils/pageSignatures";
import { renderPdfPagesToDataUrls } from "../../../shared/utils/pdfRaster";
import { printHtmlDocument } from "../../../shared/utils/printHtml";
import type { SignedPageCapture } from "../../../shared/api/mySignatures.api";
import {
  approveCase,
  getCase,
  getRegistrarErrorMessage,
  returnCase,
} from "../api";

export default function ReviewCases() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { caseId } = useParams({ from: "/review-cases/$caseId" });
  const [action, setAction] = useState<"approve" | null>(null);
  const [returnMode, setReturnMode] = useState(false);
  const [returnRemarks, setReturnRemarks] = useState("");
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
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["registrar", "cases", caseId],
    queryFn: () => getCase(caseId),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveCase(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrar", "cases"] });
      navigate({
        to: "/schedule-hearing/$caseId",
        params: { caseId },
      });
    },
    onError: (error) => setErrorMessage(getRegistrarErrorMessage(error)),
  });

  // Return-for-corrections, inline. Same mutation the standalone /return-case
  // page uses; on success it leaves the review screen for the queue.
  const returnMutation = useMutation({
    mutationFn: (remarks: string) => returnCase(caseId, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrar", "cases"] });
      navigate({ to: "/view-cases" });
    },
    onError: (error) => setErrorMessage(getRegistrarErrorMessage(error)),
  });

  // attachmentId → fresh signed URL. The edited_html snapshot still carries the
  // signed URLs from whenever the lawyer last saved — those expire after an
  // hour, so by review time any inline image would render broken. The detail
  // endpoint mints fresh URLs for every attachment; DocxPreviewSurface uses
  // this map to rewrite each floating image's <img src> (same mechanism the
  // lawyer's editor uses on case re-open).
  const attachmentUrlMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const attachment of caseData?.attachments ?? []) {
      if (attachment.url) map[attachment.id] = attachment.url;
    }
    return map;
  }, [caseData?.attachments]);

  // How many attachments came back WITHOUT a usable view URL. This is the
  // "storage was briefly unreachable" signal: the case detail itself loads
  // fine from Postgres, but the document-storage service (Supabase) can be
  // cold/asleep for a few seconds after inactivity, so its signed-URL mints
  // time out and the endpoint returns url:null. That also breaks the inline
  // preview images (their <img> keep the expired snapshot URL). A single
  // refetch, once storage has woken, re-mints every URL and repaints the
  // images — so we surface a clear Retry instead of a silent broken wall.
  const attachmentsMissingUrl = (caseData?.attachments ?? []).filter(
    (attachment) => !attachment.url
  ).length;

  // Per-page "who signed" rows for the sidebar — same badge the editor + lawyer
  // submit page use. Named by rendered section title once the preview loads.
  const signaturePageRows = useMemo(() => {
    const labelFor = (idx: number) => {
      const el = renderedPages[idx];
      return el ? derivePageLabel(el, `Page ${idx + 1}`) : `Page ${idx + 1}`;
    };
    return (caseData?.pageSignatures ?? []).map((p) => ({
      idx: p.pageIndex,
      label: labelFor(p.pageIndex),
      clientSigned: p.clientSigned,
      lawyerSigned: p.lawyerSigned,
    }));
  }, [caseData?.pageSignatures, renderedPages]);

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
      <RegistrarLayout pageSubtitle="Review Case" fullHeight>
        <div className="flex h-full items-center justify-center bg-slate-50 text-sm text-gray-600">
          Loading case…
        </div>
      </RegistrarLayout>
    );
  }

  if (isError || !caseData) {
    return (
      <RegistrarLayout pageSubtitle="Review Case" fullHeight>
        <div className="flex h-full items-center justify-center bg-slate-50 text-sm text-gray-600">
          Case not found in your review queue.
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

  const handleReturn = () => {
    const remarks = returnRemarks.trim();
    if (!remarks) {
      setErrorMessage("Add a correction note before returning the case.");
      return;
    }
    setErrorMessage(null);
    returnMutation.mutate(remarks);
  };

  // Print the COMPLETE case file: the prepared document (with the signature
  // overlays already baked into the live DOM by Effect B) followed by every
  // attachment. Everything is assembled FIRST, then handed to the shared
  // off-screen-iframe printer — so the case file shows only in the print
  // dialog and no stray about:blank tab is left behind on cancel.
  const handlePrintCompleteFile = async () => {
    setErrorMessage(null);

    // Capture the prepared document WITH the in-place signature overlays —
    // outerHTML snapshots the wrapper exactly as the registrar sees it.
    const wrapper = document.querySelector(".docx-preview-host .docx-wrapper");
    const docHtml = wrapper ? wrapper.outerHTML : "";

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

    const started = printHtmlDocument({
      title: `Complete Case File - ${caseTitleDisplay}`,
      headHtml:
        "<style>@media print { body { margin: 0; } } img { max-width: 100%; display: block; }</style>",
      bodyHtml: `${docHtml}${attachmentSections.join("")}`,
    });
    if (!started) {
      setErrorMessage("Couldn't open the print dialog. Please try again.");
    }
  };

  return (
    <RegistrarLayout pageSubtitle={caseTitleDisplay} fullHeight>
      <div className="flex h-full flex-col overflow-hidden bg-white">
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* ── Left: full-height case-file preview ─────────────────── */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
            <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/70 px-4 py-2.5">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                {caseData.signedPageIndices.length > 0
                  ? "Signed Case File"
                  : "Prepared Document"}{" "}
                — Preview
              </span>
              <span className="text-[11px] text-gray-500">
                Read-only — signatures shown in place
              </span>
            </div>

            {/* Single scroll — DocxPreviewSurface (h-full overflow-auto) fills
                this cell; no nested h-[70vh] trap, no page scroll. */}
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {caseData.editedHtml ? (
                <DocxPreviewSurface
                  arrayBuffer={null}
                  editedHtml={caseData.editedHtml}
                  isLoading={false}
                  editable={false}
                  attachmentUrlMap={attachmentUrlMap}
                  onPagesReady={(pages) => setRenderedPages(pages)}
                />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-amber-800">
                  No prepared document yet.
                </div>
              )}
            </div>
          </div>

          {/* ── Right: sticky review sidebar ─────────────────────────── */}
          <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-white max-lg:max-h-[60dvh] lg:w-[380px] lg:flex-shrink-0 lg:border-l lg:border-t-0">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Registrar Review
                </p>
                <h1 className="mt-0.5 text-lg font-semibold text-gray-900">
                  {caseTitleDisplay}
                </h1>
                <span className="mt-2 inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                  Pending Review
                </span>
              </div>

              {/* Storage-degraded notice — shown only when one or more documents
                  came back without a view URL (document storage was briefly
                  asleep). Honest wording + a one-click Retry that re-fetches the
                  case: once storage has woken, every URL re-mints and the inline
                  preview images repaint. Beats a silent "Unavailable" wall. */}
              {attachmentsMissingUrl > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-900">
                    {attachmentsMissingUrl} document
                    {attachmentsMissingUrl === 1 ? "" : "s"} couldn&apos;t be
                    loaded
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800">
                    The document storage may be waking up — this usually clears
                    in a few seconds. Retry to reload the case file and its
                    images.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      void refetch();
                    }}
                    disabled={isFetching}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-400 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`}
                    />
                    {isFetching ? "Retrying…" : "Retry"}
                  </button>
                </div>
              )}

              {/* Case information — display names only (no client/lawyer PII). */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  Case information
                </h3>
                <dl className="mt-2 space-y-2">
                  {[
                    { label: "Lawyer", value: caseData.lawyerName },
                    { label: "Client", value: caseData.clientName },
                    {
                      label: "Category",
                      value: caseData.caseTypeLabel || caseData.category,
                    },
                    { label: "Tehsil", value: caseData.assignedTehsil || "—" },
                    {
                      label: "Submitted",
                      value: caseData.submittedAt
                        ? new Date(caseData.submittedAt).toLocaleString()
                        : "—",
                    },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-start justify-between gap-3"
                    >
                      <dt className="flex-shrink-0 text-xs text-gray-500">
                        {row.label}
                      </dt>
                      <dd className="min-w-0 text-right text-xs font-medium text-gray-900">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Signatures — per-page badges (matches the editor). */}
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
                      const badge = deriveSignatureBadge(row);
                      return (
                        <li
                          key={row.idx}
                          className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
                        >
                          <p className="min-w-0 flex-1 truncate text-xs font-medium text-gray-900">
                            {row.label}
                          </p>
                          {badge && (
                            <span
                              className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Attachments are intentionally NOT listed here — the registrar
                  reviews them in place inside the document preview (each is a
                  page image with its signature badge above). A separate
                  attachments list was redundant and was removed by request. */}

              {errorMessage && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {errorMessage}
                </div>
              )}

              <button
                type="button"
                onClick={() => navigate({ to: "/view-cases" })}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to queue
              </button>
            </div>

            {/* Pinned decision actions — always visible. */}
            <div className="flex-shrink-0 space-y-2 border-t border-slate-200 p-4">
              {returnMode ? (
                <div className="space-y-2">
                  <textarea
                    value={returnRemarks}
                    onChange={(e) => setReturnRemarks(e.target.value)}
                    maxLength={2000}
                    rows={3}
                    placeholder="What needs correcting? (this note is sent to the lawyer)"
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-300"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReturnMode(false);
                        setErrorMessage(null);
                      }}
                      disabled={returnMutation.isPending}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleReturn}
                      disabled={returnMutation.isPending || !returnRemarks.trim()}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {returnMutation.isPending ? "Returning…" : "Return case"}
                    </button>
                  </div>
                </div>
              ) : action === "approve" ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600">
                    Approve this case? It moves to your Approved list and proceeds
                    to hearing scheduling.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAction(null)}
                      disabled={isMutating}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmApproval}
                      disabled={isMutating}
                      className="flex-1 rounded-lg bg-[#01411C] px-3 py-2 text-xs font-semibold text-white hover:bg-[#024a23] disabled:opacity-50"
                    >
                      {isMutating ? "Approving…" : "Confirm approval"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setAction("approve");
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#01411C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#024a23]"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Approve Case
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setReturnMode(true);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Return for Corrections
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handlePrintCompleteFile();
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <Printer className="h-4 w-4" />
                    Print Complete Case File
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </RegistrarLayout>
  );
}
