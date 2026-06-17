import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, ExternalLink, Loader2, Paperclip, Wallet } from "lucide-react";

import {
  fetchPayouts,
  getPayoutReceiptUrl,
  markPayoutPaid,
  updatePayout,
  type AdminPayout,
  type MarkPaidInput,
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

function todayString() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Which inline form (if any) is open, and on which payout.
type ActiveAction = { id: string; type: "paid" | "failed" } | null;

export default function Payouts() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [action, setAction] = useState<ActiveAction>(null);

  // Inline-form fields (shared by the paid/failed forms).
  const [reference, setReference] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [transferBank, setTransferBank] = useState("");
  const [note, setNote] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

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

  function onSuccess(title: string, message?: string) {
    queryClient.invalidateQueries({ queryKey: ["admin", "payouts"] });
    closeAction();
    setToast({ type: "success", title, message });
  }

  function onError(error: unknown) {
    setToast({
      type: "error",
      title: "Couldn't update payout",
      message: extractApiErrorMessage(error, "Please try again."),
    });
  }

  // processing / failed / cancelled — no proof needed.
  const updateMutation = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdatePayoutInput) =>
      updatePayout(id, input),
    onSuccess: (updated) => onSuccess(`Payout marked ${updated.status}`),
    onError,
  });

  // paid — with transfer proof (typed fields + receipt file).
  const markPaidMutation = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & MarkPaidInput) =>
      markPayoutPaid(id, input),
    onSuccess: (updated) =>
      onSuccess(
        "Payout marked paid",
        `${formatMoney(updated.amount)} to ${updated.lawyerName}.`
      ),
    onError,
  });

  const busy = updateMutation.isPending || markPaidMutation.isPending;

  function openAction(id: string, type: "paid" | "failed") {
    setAction({ id, type });
    setReference("");
    setTransferBank("");
    setNote("");
    setReceiptFile(null);
    setTransferDate(type === "paid" ? todayString() : "");
  }

  function closeAction() {
    setAction(null);
    setReference("");
    setTransferDate("");
    setTransferBank("");
    setNote("");
    setReceiptFile(null);
  }

  const paidFormReady =
    Boolean(reference.trim()) &&
    Boolean(transferDate) &&
    Boolean(transferBank.trim()) &&
    Boolean(receiptFile);

  function submitAction(payout: AdminPayout) {
    if (!action || busy) return;
    if (action.type === "paid") {
      if (!paidFormReady || !receiptFile) return;
      markPaidMutation.mutate({
        id: payout.id,
        reference: reference.trim(),
        transferDate,
        transferBank: transferBank.trim(),
        note: note.trim() || undefined,
        receipt: receiptFile,
      });
    } else {
      updateMutation.mutate({
        id: payout.id,
        status: "failed",
        note: note.trim() || undefined,
      });
    }
  }

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
                  Lawyers withdraw their earnings here. Transfer the amount to the
                  lawyer's bank account, then mark the payout paid — recording the
                  reference, date, sending bank, and a receipt of the transfer.
                  The lawyer is notified automatically.
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
              const isThisActionOpen = action?.id === payout.id;
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

                  {/* Transfer proof once paid */}
                  {payout.status === "paid" ? (
                    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm">
                      <p className="font-semibold text-emerald-900">Transfer proof</p>
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
                      {isThisActionOpen && action?.type === "paid" ? (
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-gray-800">
                            Record the transfer ({formatMoney(payout.amount)} to{" "}
                            {payout.lawyerName})
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Transaction ID / reference *
                              </label>
                              <input
                                type="text"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="e.g. IBFT-20260617-0098"
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#01411C] focus:outline-none focus:ring-1 focus:ring-[#01411C]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Date of transfer *
                              </label>
                              <input
                                type="date"
                                value={transferDate}
                                max={todayString()}
                                onChange={(e) => setTransferDate(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#01411C] focus:outline-none focus:ring-1 focus:ring-[#01411C]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Sent from (bank / method) *
                              </label>
                              <input
                                type="text"
                                value={transferBank}
                                onChange={(e) => setTransferBank(e.target.value)}
                                placeholder="e.g. HBL — IBFT"
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#01411C] focus:outline-none focus:ring-1 focus:ring-[#01411C]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Receipt (image or PDF) *
                              </label>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,application/pdf"
                                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#01411C] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                              Note (optional)
                            </label>
                            <input
                              type="text"
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              placeholder="Anything to record about this payout"
                              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#01411C] focus:outline-none focus:ring-1 focus:ring-[#01411C]"
                            />
                          </div>
                          {receiptFile ? (
                            <p className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Paperclip className="h-3.5 w-3.5" />
                              {receiptFile.name}
                            </p>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={busy || !paidFormReady}
                              onClick={() => submitAction(payout)}
                              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {markPaidMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              Confirm paid
                            </button>
                            <button
                              type="button"
                              onClick={closeAction}
                              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : isThisActionOpen && action?.type === "failed" ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                              Reason (shown to the lawyer, optional)
                            </label>
                            <input
                              type="text"
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              placeholder="Why did the transfer fail?"
                              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#01411C] focus:outline-none focus:ring-1 focus:ring-[#01411C]"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => submitAction(payout)}
                              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {updateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              Confirm failed
                            </button>
                            <button
                              type="button"
                              onClick={closeAction}
                              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {payout.status === "requested" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                updateMutation.mutate({ id: payout.id, status: "processing" })
                              }
                              className="rounded-lg px-4 py-2 text-sm font-medium text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50 disabled:opacity-50"
                            >
                              Mark processing
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openAction(payout.id, "paid")}
                            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                          >
                            Mark as paid
                          </button>
                          <button
                            type="button"
                            onClick={() => openAction(payout.id, "failed")}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"
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
