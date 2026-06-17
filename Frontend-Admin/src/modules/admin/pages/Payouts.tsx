import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Loader2, Wallet } from "lucide-react";

import {
  fetchPayouts,
  updatePayout,
  type AdminPayout,
  type PayoutStatus,
  type PayoutTargetStatus,
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

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatMoney(value: number) {
  return `Rs ${value.toLocaleString()}`;
}

// Which inline form (if any) is open, and on which payout.
type ActiveAction = { id: string; type: "paid" | "failed" } | null;

export default function Payouts() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [action, setAction] = useState<ActiveAction>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
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

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...input
    }: { id: string; status: PayoutTargetStatus; reference?: string; note?: string }) =>
      updatePayout(id, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "payouts"] });
      closeAction();
      setToast({
        type: "success",
        title: `Payout marked ${updated.status}`,
        message:
          updated.status === "paid"
            ? `${formatMoney(updated.amount)} to ${updated.lawyerName}.`
            : undefined,
      });
    },
    onError: (error) => {
      setToast({
        type: "error",
        title: "Couldn't update payout",
        message: extractApiErrorMessage(error, "Please try again."),
      });
    },
  });

  function openAction(id: string, type: "paid" | "failed") {
    setAction({ id, type });
    setReference("");
    setNote("");
  }

  function closeAction() {
    setAction(null);
    setReference("");
    setNote("");
  }

  function submitAction(payout: AdminPayout) {
    if (!action) return;
    if (action.type === "paid" && !reference.trim()) return;
    updateMutation.mutate({
      id: payout.id,
      status: action.type,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    });
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
                  Lawyers withdraw their earnings here. Transfer the amount to
                  the lawyer's bank account, then mark the payout paid with a
                  bank reference. The lawyer is notified automatically.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800">
              {payoutsQuery.isLoading
                ? "Loading…"
                : `${openCount} awaiting action`}
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
                        <p className="text-sm text-gray-500">
                          {payout.lawyerEmail}
                        </p>
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
                      <p>Requested {formatDate(payout.requestedAt)}</p>
                      {payout.processedAt ? (
                        <p>
                          Processed {formatDate(payout.processedAt)}
                          {payout.processedByName ? ` by ${payout.processedByName}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Reference / note once set */}
                  {payout.reference || payout.note ? (
                    <div className="mt-3 text-sm text-gray-600">
                      {payout.reference ? (
                        <p>
                          <span className="font-medium text-gray-800">Reference:</span>{" "}
                          {payout.reference}
                        </p>
                      ) : null}
                      {payout.note ? (
                        <p>
                          <span className="font-medium text-gray-800">Note:</span>{" "}
                          {payout.note}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Actions */}
                  {actionable ? (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      {isThisActionOpen ? (
                        <div className="space-y-3">
                          {action?.type === "paid" ? (
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Bank reference (required)
                              </label>
                              <input
                                type="text"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="e.g. IBFT-20260617-0098"
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#01411C] focus:outline-none focus:ring-1 focus:ring-[#01411C]"
                              />
                            </div>
                          ) : null}
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                              Note {action?.type === "failed" ? "(optional)" : "(optional)"}
                            </label>
                            <input
                              type="text"
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              placeholder={
                                action?.type === "failed"
                                  ? "Why did it fail? (shown to the lawyer)"
                                  : "Anything to record about this payout"
                              }
                              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#01411C] focus:outline-none focus:ring-1 focus:ring-[#01411C]"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={
                                updateMutation.isPending ||
                                (action?.type === "paid" && !reference.trim())
                              }
                              onClick={() => submitAction(payout)}
                              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                action?.type === "paid"
                                  ? "bg-emerald-700 hover:bg-emerald-800"
                                  : "bg-rose-600 hover:bg-rose-700"
                              }`}
                            >
                              {updateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              Confirm {action?.type === "paid" ? "paid" : "failed"}
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
                              disabled={updateMutation.isPending}
                              onClick={() =>
                                updateMutation.mutate({
                                  id: payout.id,
                                  status: "processing",
                                })
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
