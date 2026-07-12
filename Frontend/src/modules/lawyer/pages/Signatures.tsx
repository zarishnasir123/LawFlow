import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  Download,
  FileCheck2,
  FileSignature,
  History,
  Loader2,
  PenLine,
} from "lucide-react";

import LawyerLayout from "../components/LawyerLayout";
import SignedPdfPreviewModal from "../components/SignedPdfPreviewModal";
import {
  mySignaturesApi,
  type ApiPendingSignature,
  getMySignaturesErrorMessage,
} from "../../../shared/api/mySignatures.api";
import { casesApi, type ApiCase, getCasesErrorMessage } from "../api/cases.api";
import { signaturesApi } from "../signatures/api/signatures.api";

// Render a "Client + Lawyer" / "Client only" / "Lawyer only" pill from the
// distinct signer-role set the backend ships on each signed case. Lawyers
// were mixing up self-signed artifacts with counter-signed ones at a
// glance; this chip makes the signer-mix unambiguous on the tracker row.
function SignerMixBadge({ roles }: { roles: ApiCase["signedByRoles"] }) {
  const set = new Set(roles ?? []);
  const hasClient = set.has("client");
  const hasLawyer = set.has("lawyer");

  if (hasClient && hasLawyer) {
    return (
      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-100">
        Client + Lawyer
      </span>
    );
  }
  if (hasClient) {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">
        Client only
      </span>
    );
  }
  if (hasLawyer) {
    return (
      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-100">
        Lawyer only
      </span>
    );
  }
  return null;
}

// Lawyer's own signatures inbox + activity log.
//
// Pending section: signature_requests where recipient_user_id === me
// AND status='pending'. Powers the "Review & Sign" CTA path.
//
// Activity log: terminal-state rows the lawyer has been a signer on —
// signed, cancelled (lawyer's own batches can be cancelled too), or
// expired. Same data shape as the pending list so we render with
// the same row component. Mirrors the client-side CaseTracking
// activity log so both signers see their history the same way.

function formatDateTime(value?: string) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateOnly(value?: string) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Translate a historical row's status into a human-friendly verb +
// timeline-dot color for the activity log entries. Mirrors the
// client-side helper so the two pages read the same.
function describeHistoryAction(status: ApiPendingSignature["status"]) {
  switch (status) {
    case "signed":
      return { verb: "You signed", dotColor: "bg-emerald-400" };
    case "cancelled":
      return { verb: "Withdrawn", dotColor: "bg-red-400" };
    case "expired":
      return { verb: "Expired", dotColor: "bg-gray-300" };
    default:
      return { verb: "Closed", dotColor: "bg-gray-300" };
  }
}

export default function Signatures() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<ApiPendingSignature[]>([]);
  const [history, setHistory] = useState<ApiPendingSignature[]>([]);
  // Cases where the PDF compile has finished — drives the "Signed
  // Documents" tracker section below. Lives here (not on
  // /lawyer-cases) so signed-PDF management has its own dedicated
  // surface alongside the signing inbox.
  const [signedCases, setSignedCases] = useState<ApiCase[]>([]);
  const [signedError, setSignedError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Activity log starts collapsed — pending is the primary surface.
  // Mirrors the lawyer-editor signature panel and the client
  // /case-tracking pattern.
  const [historyOpen, setHistoryOpen] = useState(false);
  // Case being previewed in the popup PDF viewer. The previous flow
  // navigated to /lawyer-submit-case, which dropped the lawyer into
  // the registrar-submission UI just to look at a signed file — too
  // much context switching for a quick verification pass.
  const [previewCase, setPreviewCase] = useState<ApiCase | null>(null);

  // Open the signed PDF in a new tab. Fresh 5-min signed URL is
  // minted on every call so a stale URL never blocks the download.
  const handleDownloadSignedPdf = async (caseId: string) => {
    try {
      const { downloadUrl } = await signaturesApi.downloadSignedPdf(caseId);
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch signed PDF";
      alert(message);
    }
  };

  // Mount-only fetch — loading/error start in their initial states
  // (true / null), so no synchronous setState is needed here.
  useEffect(() => {
    let cancelled = false;
    // Three parallel fetches: pending inbox, history log, and the
    // dedicated signed-cases list. Each failure is isolated so a
    // slow / failing one doesn't block the others.
    Promise.all([
      mySignaturesApi.listPending(),
      mySignaturesApi.listHistory().catch(() => [] as ApiPendingSignature[]),
      casesApi.listMySignedCases().catch((err) => {
        if (!cancelled) setSignedError(getCasesErrorMessage(err));
        return [] as ApiCase[];
      }),
    ])
      .then(([pendingRows, historyRows, signedRows]) => {
        if (cancelled) return;
        // Filter to lawyer rows so a lawyer who happens to also be a
        // client on someone else's case doesn't see those rows here.
        setPending(pendingRows.filter((r) => r.signerRole === "lawyer"));
        setHistory(historyRows.filter((r) => r.signerRole === "lawyer"));
        setSignedCases(signedRows);
      })
      .catch((err) => {
        if (!cancelled) setError(getMySignaturesErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle="Signatures">
      <div className="space-y-4">
        {/* Signing inbox — one clean row per waiting document. Titles
            carry the weight; everything else folds into a single quiet
            meta line so the card never reads as a wall of micro-text. */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2.5 text-[#01411C]">
                <PenLine className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Sign Your Documents
                </h2>
                <p className="text-sm text-gray-500">
                  Documents waiting on your signature before the case can move
                  forward.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-[#01411C] ring-1 ring-emerald-200">
              {pending.length} pending
            </span>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading your signature inbox…
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                {error}
              </div>
            ) : pending.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center text-sm text-gray-600">
                No documents waiting for your signature right now.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {pending.map((req) => {
                  const pageCount = req.pageIndices?.length || 0;
                  return (
                    <li
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-4 px-1 py-4 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#01411C]">
                          <FileSignature className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-gray-900">
                            {req.caseTitle}
                          </p>
                          <p className="mt-0.5 text-sm text-gray-500">
                            {pageCount > 0
                              ? `${pageCount} page${pageCount === 1 ? "" : "s"} · `
                              : ""}
                            Requested {formatDateOnly(req.createdAt)} · Expires{" "}
                            {formatDateOnly(req.expiresAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-3">
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                          Pending
                        </span>
                        <button
                          onClick={() =>
                            navigate({ to: `/lawyer-signatures/${req.id}` })
                          }
                          className="inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23]"
                        >
                          <PenLine className="h-4 w-4" />
                          Review &amp; Sign
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Activity log — terminal-state rows where I was the signer.
            Collapsed by default; expand to audit "did I sign that?"
            without leaving the inbox. Same shape as /case-tracking's. */}
        {history.length > 0 && (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={() => setHistoryOpen((prev) => !prev)}
              aria-expanded={historyOpen}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left transition-colors hover:bg-gray-50"
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                <History className="h-4 w-4 text-gray-400" />
                Activity log
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                  {history.length}
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-gray-400 transition-transform ${
                  historyOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {historyOpen && (
              <ul className="mt-3 divide-y divide-gray-50">
                {history.map((req) => {
                  const { verb, dotColor } = describeHistoryAction(req.status);
                  const pageCount = req.pageIndices?.length || 0;
                  // Use the most recent state-change timestamp so the
                  // row reads naturally — signedAt for completed
                  // signatures, updatedAt otherwise.
                  const stampSource =
                    req.status === "signed" && req.signedAt
                      ? req.signedAt
                      : req.updatedAt || req.createdAt;
                  return (
                    <li
                      key={req.id}
                      className="flex items-center gap-3 px-2 py-2.5 text-sm text-gray-600"
                    >
                      <span
                        aria-hidden
                        className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${dotColor}`}
                      />
                      <p className="min-w-0 flex-1 truncate">
                        <span className="font-semibold text-gray-700">
                          {formatDateOnly(stampSource)}
                        </span>{" "}
                        · {verb}{" "}
                        <span className="font-medium text-gray-900">
                          {req.caseTitle}
                        </span>
                        {pageCount > 0 ? (
                          <span className="text-gray-400">
                            {" "}
                            · {pageCount} page{pageCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* Signed Documents tracker — every case the lawyer owns where
            the PDF compile has finished. Each row: strong title + a
            single meta line, actions on the right. */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2.5 text-[#01411C]">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Signed Documents
                </h3>
                <p className="text-sm text-gray-500">
                  Finalised PDFs after every signer completed their signature.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-[#01411C] ring-1 ring-emerald-200">
              {signedCases.length}
            </span>
          </div>

          <div className="p-5">
            {signedError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {signedError}
              </div>
            ) : signedCases.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center text-sm text-gray-500">
                No signed PDFs yet. They appear here automatically once every
                signer on a case has submitted their signature.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {signedCases.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-1 py-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#01411C]">
                        <FileCheck2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[15px] font-semibold text-gray-900">
                            {c.title}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                              c.caseCategory === "civil"
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                                : "bg-purple-50 text-purple-700 ring-purple-100"
                            }`}
                          >
                            {c.caseCategory === "civil" ? "Civil" : "Family"}
                          </span>
                          <SignerMixBadge roles={c.signedByRoles} />
                        </div>
                        <p className="mt-0.5 truncate text-sm text-gray-500">
                          {c.caseTypeName} · Client: {c.clientName} · Compiled{" "}
                          {c.signedPdfGeneratedAt
                            ? formatDateTime(c.signedPdfGeneratedAt)
                            : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewCase(c)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 hover:border-[#01411C] hover:text-[#01411C]"
                      >
                        <FileSignature className="h-4 w-4" />
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSignedPdf(c.id)}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#024a23]"
                      >
                        <Download className="h-4 w-4" />
                        Download PDF
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {previewCase && (
        <SignedPdfPreviewModal
          caseId={previewCase.id}
          caseTitle={previewCase.title}
          compiledAt={previewCase.signedPdfGeneratedAt}
          onClose={() => setPreviewCase(null)}
        />
      )}
    </LawyerLayout>
  );
}
