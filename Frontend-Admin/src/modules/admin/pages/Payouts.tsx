import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, ExternalLink, Loader2, Send, Wallet } from "lucide-react";

import {
  fetchPayouts,
  disbursePayout,
  getPayoutReceiptUrl,
  updatePayout,
  type PayoutStatus,
  type UpdatePayoutInput,
} from "../api/payouts";
import { extractApiErrorMessage } from "../../../shared/api/extractApiErrorMessage";
import StatusToast from "../components/modals/StatusToast";

// "all" is a UI-only sentinel mapping to an omitted status query param.
type StatusFilter = "all" | PayoutStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "requested", label: "Requested" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_BADGE: Record<PayoutStatus, string> = {
  requested: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  paid: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-700",
  cancelled: "bg-gray-100 text-gray-600",
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatMoney(value: number) {
  return `Rs ${value.toLocaleString()}`;
}

export default function Payouts() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("all");

  // Which payout (if any) has its "mark failed" reason form open, and the note.
  const [failingId, setFailingId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    title: string;
    message?: string;
  } | null>(null);

  const payoutsQuery = useQuery({
    queryKey: ["admin", "payouts", status],
    queryFn: () => fetchPayouts(status === "all" ? undefined : status),
    placeholderData: keepPreviousData,
  });

  function resetFailForm() {
    setFailingId(null);
    setNote("");
  }

  function onSuccess(title: string, message?: string) {
    // Invalidating the ["admin", "payouts"] prefix also refreshes the sidebar
    // Payouts badge (it shares the ["admin", "payouts", "all"] cache).
    queryClient.invalidateQueries({ queryKey: ["admin", "payouts"] });
    resetFailForm();
    setToast({ type: "success", title, message });
  }

  function onError(error: unknown) {
    setToast({
      type: "error",
      title: "Couldn't update payout",
      message: extractApiErrorMessage(error, "Please try again."),
    });
  }

  // One-click payout: "send" via the disbursement adapter and mark it paid.
  const disburseMutation = useMutation({
    mutationFn: (id: string) => disbursePayout(id),
    onSuccess: (updated) =>
      onSuccess(
        "Payment sent",
        `${formatMoney(updated.amount)} sent to ${updated.lawyerName} (ref ${
          updated.reference ?? "—"
        }).`
      ),
    onError,
  });

  // Mark a payout failed (money returns to the lawyer's available balance).
  const updateMutation = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdatePayoutInput) =>
      updatePayout(id, input),
    onSuccess: (updated) => onSuccess(`Payout marked ${updated.status}`),
    onError,
  });

  const busy = disburseMutation.isPending || updateMutation.isPending;

  async function viewReceipt(id: string) {
    setReceiptLoadingId(id);
    try {
      const url = await getPayoutReceiptUrl(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setToast({
        type: "error",
        title: "Couldn't open receipt",
        message: extractApiErrorMessage(error, "Please try again."),
      });
    } finally {
      setReceiptLoadingId(null);
    }
  }

  const payouts = payoutsQuery.data ?? [];
  const openCount = payouts.filter(
    (p) => p.status === "requested" || p.status === "processing"
  ).length;

  return (
    <div className="w-full px-6 lg:px-8 xl:px-10 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {toast ? (
          <StatusToast
            open
            type={toast.type}
            title={toast.title}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        ) : null}

        {/* Hero / intro */}
        <section className="rounded-2xl border border-green-100 bg-gradient-to-br from-white via-white to-green-50/40 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#01411C] text-white">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#01411C]">Payouts</h1>
                <p className="mt-1 max-w-3xl text-sm text-gray-600">
                  Lawyers withdraw their earnings here. Click{" "}
                  <span className="font-semibold">Approve &amp; Send Payment</span> to
                  send a payout to the lawyer's saved bank account — the reference
                  is generated automatically and the lawyer is notified. This build
                  uses a sandbox-simulated payout rail; a licensed bank rail
                  (RAAST/1Link) plugs into the same step in production.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800">
              {payoutsQuery.isLoading ? "Loading…" : `${openCount} awaiting action`}
            </div>
          </div>
        </section>

        {/* Status filter */}
        <section className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((filter) => {
            const active = status === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatus(filter.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "bg-[#01411C] text-white shadow-sm"
                    : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </section>

        {/* List */}
        {payoutsQuery.isLoading ? (
          <div className="py-10 text-center text-gray-600">Loading payouts…</div>
        ) : payouts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-base font-medium text-gray-800">
              No payouts {status === "all" ? "yet" : `with status "${status}"`}.
            </p>
            <p className="mt-2 text-sm text-gray-600">
              When a lawyer requests a withdrawal, it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {payouts.map((payout) => {
              const actionable =
                payout.status === "requested" || payout.status === "processing";
              const isFailing = failingId === payout.id;
              const isDisbursing =
                disburseMutation.isPending &&
                disburseMutation.variables === payout.id;
              return (
                <div
                  key={payout.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-gray-900">
                        {payout.lawyerName}
                      </p>
                      {payout.lawyerEmail ? (
                        <p className="text-sm text-gray-500">{payout.lawyerEmail}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[payout.status]}`}
                      >
                        {payout.status}
                      </span>
                      <span className="text-xl font-bold text-[#01411C]">
                        {formatMoney(payout.amount)}
                      </span>
                    </div>
                  </div>

                  {/* Bank + meta */}
                  <div className="mt-4 grid gap-3 rounded-xl bg-slate-50/70 p-4 text-sm sm:grid-cols-2">
                    <div className="flex items-start gap-2">
                      <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-800">
                          {payout.bankName || "Bank not set"}
                        </p>
                        <p className="text-gray-600">
                          {payout.accountTitle || "—"}
                          {payout.accountNumber ? ` · ${payout.accountNumber}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-gray-600 sm:text-right">
                      <p>Requested {formatDateTime(payout.requestedAt)}</p>
                      {payout.processedAt ? (
                        <p>
                          Processed {formatDateTime(payout.processedAt)}
                          {payout.processedByName ? ` by ${payout.processedByName}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Payout details once paid */}
                  {payout.status === "paid" ? (
                    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm">
                      <p className="font-semibold text-emerald-900">Payout details</p>
                      <div className="mt-1 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                        <p className="text-gray-700">
                          <span className="font-medium text-gray-800">Reference:</span>{" "}
                          {payout.reference || "—"}
                        </p>
                        <p className="text-gray-700">
                          <span className="font-medium text-gray-800">Sent on:</span>{" "}
                          {formatDate(payout.transferDate)}
                        </p>
                        <p className="text-gray-700">
                          <span className="font-medium text-gray-800">Via:</span>{" "}
                          {payout.transferBank || "—"}
                        </p>
                        {payout.note ? (
                          <p className="text-gray-700">
                            <span className="font-medium text-gray-800">Note:</span>{" "}
                            {payout.note}
                          </p>
                        ) : null}
                      </div>
                      {payout.hasReceipt ? (
                        <button
                          type="button"
                          onClick={() => viewReceipt(payout.id)}
                          disabled={receiptLoadingId === payout.id}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          {receiptLoadingId === payout.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ExternalLink className="h-4 w-4" />
                          )}
                          View receipt
                        </button>
                      ) : null}
                    </div>
                  ) : payout.note ? (
                    <p className="mt-3 text-sm text-gray-600">
                      <span className="font-medium text-gray-800">Note:</span> {payout.note}
                    </p>
                  ) : null}

                  {/* Actions */}
                  {actionable ? (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      {isFailing ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                              Reason (shown to the lawyer, optional)
                            </label>
                            <input
                              type="text"
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              placeholder="Why did the payout fail?"
                              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#01411C] focus:outline-none focus:ring-1 focus:ring-[#01411C]"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                updateMutation.mutate({
                                  id: payout.id,
                                  status: "failed",
                                  note: note.trim() || undefined,
                                })
                              }
                              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {updateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              Confirm failed
                            </button>
                            <button
                              type="button"
                              onClick={resetFailForm}
                              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => disburseMutation.mutate(payout.id)}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isDisbursing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            Approve &amp; Send Payment
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setFailingId(payout.id);
                              setNote("");
                            }}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Mark failed
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
