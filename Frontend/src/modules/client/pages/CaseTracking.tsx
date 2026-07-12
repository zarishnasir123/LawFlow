import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  Eye,
  FileSignature,
  History,
  Loader2,
  PenLine,
} from "lucide-react";

import ClientLayout from "../components/ClientLayout";
import Card from "../../../shared/components/dashboard/Card";
import {
  mySignaturesApi,
  type ApiPendingSignature,
  getMySignaturesErrorMessage,
} from "../../../shared/api/mySignatures.api";

function Badge({ text, color }: { text: string; color?: string }) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${
        color || "bg-gray-100 text-gray-600"
      }`}
    >
      {text}
    </span>
  );
}

function formatDateOnly(value?: string) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Client-side "Pending Signatures" view (FE-5).
//
// Lists every signature_request where:
//   - recipient_user_id === current client
//   - status === 'pending'
//   - not expired
// Sourced live from /api/me/signature-requests; the row's "Open" button
// drops the client into the in-app signing viewer.
// Translate a historical row's status into a human-friendly verb +
// timeline-dot color. Kept inline because the mapping is unique to
// the recipient's audit log (the lawyer-side panel only sees
// cancelled/expired in its history bucket).
function describeHistoryAction(status: ApiPendingSignature["status"]) {
  switch (status) {
    case "signed":
      return { verb: "You signed", dotColor: "bg-emerald-400" };
    case "cancelled":
      return { verb: "Lawyer withdrew", dotColor: "bg-red-400" };
    case "expired":
      return { verb: "Expired", dotColor: "bg-gray-300" };
    default:
      return { verb: "Closed", dotColor: "bg-gray-300" };
  }
}

export default function CaseTracking() {
  const navigate = useNavigate();
  const [pendingRequests, setPendingRequests] = useState<ApiPendingSignature[]>([]);
  const [historyRequests, setHistoryRequests] = useState<ApiPendingSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Activity log starts collapsed — mirrors the lawyer-side panel.
  // Clients only need to dig into history occasionally; the active
  // queue is the primary affordance.
  const [historyOpen, setHistoryOpen] = useState(false);

  // Mount-only fetch — loading/error start in their initial states
  // (true / null), so no synchronous setState is needed here.
  useEffect(() => {
    let cancelled = false;
    // Fetch pending + history in parallel — same auth, two cheap
    // queries, single render once both land. A history-fetch failure
    // alone doesn't block the pending list (caught inside Promise.all).
    Promise.all([
      mySignaturesApi.listPending(),
      mySignaturesApi.listHistory().catch(() => [] as ApiPendingSignature[]),
    ])
      .then(([pending, history]) => {
        if (cancelled) return;
        setPendingRequests(pending);
        setHistoryRequests(history);
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
    <ClientLayout
      brandSubtitle="Pending Signatures"
      showBackButton
      onBackClick={() => navigate({ to: "/client-dashboard" })}
    >
      <div className="space-y-6">
        <Card className="border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2.5 text-[#01411C]">
                <FileSignature className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Pending Signatures
                </h3>
                <p className="text-sm text-gray-500">
                  Documents your lawyer sent for your signature.
                </p>
              </div>
            </div>
            <Badge
              text={`${pendingRequests.length} Pending`}
              color="bg-amber-50 text-amber-700 ring-1 ring-amber-200"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your signature requests…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
              {error}
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-6 text-center text-sm text-gray-600">
              No documents are waiting for your signature right now.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => {
                const pageCount = req.pageIndices?.length || 0;
                return (
                  <div
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#01411C]">
                        <FileSignature className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-gray-900">
                          {req.caseTitle}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-gray-500">
                          {pageCount > 0
                            ? `${pageCount} page${pageCount === 1 ? "" : "s"} · `
                            : ""}
                          Sent by {req.requestingLawyerName} · Expires{" "}
                          {formatDateOnly(req.expiresAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      <Badge
                        text="Pending"
                        color="bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                      />
                      <button
                        onClick={() =>
                          navigate({ to: `/client-signatures/${req.id}` })
                        }
                        className="inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23]"
                      >
                        <PenLine className="h-4 w-4" />
                        Review &amp; Sign
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Activity log — collapsible, lives below the active queue.
            Shows withdrawn / expired / signed rows so the recipient
            can answer "did the lawyer pull that back?" or "did I
            already sign that?" without leaving the dashboard. */}
        {historyRequests.length > 0 && (
          <Card className="border border-gray-200 bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={() => setHistoryOpen((prev) => !prev)}
              aria-expanded={historyOpen}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left transition-colors hover:bg-gray-50"
            >
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                <History className="h-3.5 w-3.5" />
                Activity log
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                  {historyRequests.length}
                </span>
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-gray-400 transition-transform ${
                  historyOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {historyOpen && (
              <ul className="mt-3 space-y-1.5">
                {historyRequests.map((req) => {
                  const { verb, dotColor } = describeHistoryAction(req.status);
                  const pageCount = req.pageIndices?.length || 0;
                  // Prefer the most recent state-change timestamp so
                  // the row reads naturally ("Lawyer withdrew on …",
                  // "You signed on …"). signedAt only exists for
                  // status='signed'; updatedAt covers the rest.
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
                      {/* Signed rows open the read-only preview of the
                          signed pages (same viewer route — it flips to
                          preview mode for completed requests). */}
                      {req.status === "signed" ? (
                        <button
                          type="button"
                          onClick={() =>
                            navigate({ to: `/client-signatures/${req.id}` })
                          }
                          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#01411C] transition-colors hover:border-[#01411C] hover:bg-emerald-50/50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}
      </div>
    </ClientLayout>
  );
}
