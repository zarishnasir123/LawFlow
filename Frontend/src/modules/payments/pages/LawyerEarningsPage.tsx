import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, Banknote, ArrowUpRight, Loader2 } from "lucide-react";
import LawyerLayout from "../../lawyer/components/LawyerLayout";
import TransactionHistoryList from "../components/TransactionHistoryList";
import PayoutAccountCard from "../components/PayoutAccountCard";
import {
  getLawyerEarnings,
  getLawyerPayoutAccount,
  getLawyerPayouts,
  requestLawyerPayout,
} from "../api";
import type { PayoutStatus } from "../api";
import type { PaymentTransaction } from "../types/payments";
import { formatCurrency } from "../utils/paymentCalculations";

function installmentLabel(installmentNumber?: number): string {
  if (installmentNumber === 0) return "Service Charge";
  if (typeof installmentNumber === "number" && installmentNumber > 0) {
    return `Installment #${installmentNumber}`;
  }
  return "Installment";
}

function formatPayoutDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

// Pull a human message off an axios-style error, else a fallback.
function errorMessage(error: unknown, fallback: string): string {
  const r = error as { response?: { data?: { message?: string } } };
  return r?.response?.data?.message || fallback;
}

const PAYOUT_STATUS_STYLES: Record<PayoutStatus, { label: string; className: string }> = {
  requested: { label: "Requested", className: "bg-amber-100 text-amber-800" },
  processing: { label: "Processing", className: "bg-blue-100 text-blue-800" },
  paid: { label: "Paid", className: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Failed", className: "bg-rose-100 text-rose-700" },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-600" },
};

function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  const style = PAYOUT_STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.className}`}
    >
      {style.label}
    </span>
  );
}

// One line in the "Earnings breakdown" panel. `tone` styles deductions (minus
// amounts) and the running subtotals; `divider`/`total` add separating rules.
function BreakdownRow({
  label,
  value,
  tone = "default",
  divider = false,
  total = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "deduction" | "subtotal";
  divider?: boolean;
  total?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${
        divider ? "border-t border-gray-200 pt-3" : ""
      } ${total ? "border-t-2 border-emerald-200 pt-3" : ""}`}
    >
      <dt
        className={`text-sm ${
          total ? "font-semibold text-gray-900" : "text-gray-600"
        }`}
      >
        {label}
      </dt>
      <dd
        className={`text-sm tabular-nums ${
          total
            ? "text-lg font-bold text-[#01411C]"
            : tone === "deduction"
              ? "font-medium text-rose-600"
              : tone === "subtotal"
                ? "font-semibold text-gray-900"
                : "font-medium text-gray-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export default function LawyerEarningsPage() {
  const queryClient = useQueryClient();

  const { data: earnings, isLoading } = useQuery({
    queryKey: ["lawyer-earnings"],
    queryFn: getLawyerEarnings,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: payouts } = useQuery({
    queryKey: ["lawyer-payouts"],
    queryFn: getLawyerPayouts,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: payoutAccount } = useQuery({
    queryKey: ["lawyer-payout-account"],
    queryFn: getLawyerPayoutAccount,
  });

  const requestMutation = useMutation({
    mutationFn: requestLawyerPayout,
    onSuccess: () => {
      // Both the balance and the history move when a payout is requested.
      queryClient.invalidateQueries({ queryKey: ["lawyer-earnings"] });
      queryClient.invalidateQueries({ queryKey: ["lawyer-payouts"] });
    },
  });

  const available = earnings?.balance.available ?? 0;
  // A requested/processing payout ties up money — only one open at a time.
  const openPayout = (payouts || []).find(
    (p) => p.status === "requested" || p.status === "processing"
  );
  const hasBankAccount = Boolean(payoutAccount?.accountNumber);
  const canRequestPayout =
    available > 0 && !openPayout && hasBankAccount && !requestMutation.isPending;

  const recentTransactions = useMemo<PaymentTransaction[]>(
    () =>
      (earnings?.recent || []).map((t) => ({
        id: t.id,
        caseId: "",
        planId: "",
        installmentId: t.installmentId,
        amount: t.amount,
        method: "card",
        status: t.status === "success" ? "success" : "failed",
        createdAt: t.createdAt,
        provider: "safepay",
      })),
    [earnings]
  );

  const recentLabels = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        (earnings?.recent || []).map((t) => [
          t.installmentId,
          installmentLabel(t.installmentNumber),
        ])
      ),
    [earnings]
  );

  const hasEarnings = Boolean(earnings && earnings.paymentsCount > 0);

  return (
    <LawyerLayout brandSubtitle="Payments Received">
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/40 to-white p-6 shadow-[0_20px_50px_-35px_rgba(1,65,28,0.45)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#01411C]">
            <Wallet className="h-3.5 w-3.5" />
            Payments Received
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">Your Earnings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Payments your clients have made against their installment plans.
            LawFlow collects these and settles your share to your payout account
            (set it up below). This page is your record of what's been received.
          </p>
        </div>

        <PayoutAccountCard />

        {isLoading ? (
          <div className="py-8 text-center text-gray-600">Loading your earnings…</div>
        ) : !hasEarnings ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-base font-medium text-gray-800">No payments received yet.</p>
            <p className="mt-2 text-sm text-gray-600">
              Once a client pays an installment, it will appear here with a receipt.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-5">
              {/* Headline: the money the lawyer can actually withdraw. */}
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-[#01411C] to-emerald-700 p-6 text-white shadow-[0_20px_50px_-30px_rgba(1,65,28,0.6)] lg:col-span-2">
                <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-50">
                  <Banknote className="h-4 w-4" />
                  Available to withdraw
                </div>
                <p className="mt-2 text-4xl font-bold tabular-nums">
                  {formatCurrency(earnings!.balance.available)}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-emerald-50/90">
                  Your share that LawFlow is holding for you, after our platform
                  fee and anything already paid out.
                </p>

                <button
                  type="button"
                  disabled={!canRequestPayout}
                  onClick={() => requestMutation.mutate()}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#01411C] shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-white/70"
                >
                  {requestMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Requesting…
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="h-4 w-4" />
                      Request payout
                    </>
                  )}
                </button>

                {/* Why the button is (un)available, or the outcome of a click. */}
                <p className="mt-2 text-xs leading-relaxed text-emerald-50/90">
                  {openPayout
                    ? `You have a payout of ${formatCurrency(openPayout.amount)} ${
                        openPayout.status === "processing"
                          ? "being processed"
                          : "awaiting admin approval"
                      }. We'll notify you when it's paid.`
                    : !hasBankAccount
                      ? "Add your payout bank account below to enable withdrawals."
                      : available <= 0
                        ? "You'll be able to withdraw once you have an available balance."
                        : "LawFlow will transfer this to your saved bank account."}
                </p>

                {requestMutation.isError && (
                  <p className="mt-2 rounded-lg bg-rose-500/25 px-3 py-2 text-xs font-medium text-white">
                    {errorMessage(
                      requestMutation.error,
                      "Couldn't request the payout. Please try again."
                    )}
                  </p>
                )}
              </div>

              {/* The math behind the available balance, top to bottom. */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  Earnings breakdown
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  How your available balance is worked out, from{" "}
                  {earnings!.paymentsCount}{" "}
                  {earnings!.paymentsCount === 1 ? "payment" : "payments"} received.
                </p>
                <dl className="mt-4 space-y-3">
                  <BreakdownRow
                    label="Total received from clients"
                    value={formatCurrency(earnings!.balance.grossEarned)}
                  />
                  <BreakdownRow
                    label={`LawFlow platform fee (${earnings!.balance.commissionRate}%)`}
                    value={`− ${formatCurrency(earnings!.balance.platformFee)}`}
                    tone="deduction"
                  />
                  <BreakdownRow
                    label="Your net earnings"
                    value={formatCurrency(earnings!.balance.netEarned)}
                    tone="subtotal"
                    divider
                  />
                  {earnings!.balance.paidOut > 0 && (
                    <BreakdownRow
                      label="Already paid out to you"
                      value={`− ${formatCurrency(earnings!.balance.paidOut)}`}
                      tone="deduction"
                    />
                  )}
                  {earnings!.balance.pendingPayouts > 0 && (
                    <BreakdownRow
                      label="Payout in progress"
                      value={`− ${formatCurrency(earnings!.balance.pendingPayouts)}`}
                      tone="deduction"
                    />
                  )}
                  <BreakdownRow
                    label="Available to withdraw"
                    value={formatCurrency(earnings!.balance.available)}
                    total
                  />
                </dl>
              </div>
            </div>

            {(payouts || []).length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">Payout History</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Withdrawals of your earnings to your bank account.
                </p>
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full min-w-[720px]">
                    <thead>
                      <tr className="border-b border-gray-200 bg-slate-50/90">
                        {["Requested", "Amount", "Bank Account", "Status", "Reference / Note", "Processed"].map(
                          (heading) => (
                            <th
                              key={heading}
                              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                            >
                              {heading}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(payouts || []).map((payout) => (
                        <tr
                          key={payout.id}
                          className="border-b border-gray-100 odd:bg-white even:bg-slate-50/30"
                        >
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {formatPayoutDate(payout.requestedAt)}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-[#01411C]">
                            {formatCurrency(payout.amount)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {payout.bankName || "—"}
                            {payout.accountNumber ? (
                              <span className="block text-xs text-gray-400">
                                {payout.accountNumber}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <PayoutStatusBadge status={payout.status} />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {payout.reference ||
                              (payout.status === "failed" ||
                              payout.status === "cancelled"
                                ? payout.note || "—"
                                : "—")}
                            {payout.status === "paid" &&
                            (payout.transferDate || payout.transferBank) ? (
                              <span className="block text-xs text-gray-400">
                                Sent {payout.transferDate || "—"}
                                {payout.transferBank
                                  ? ` via ${payout.transferBank}`
                                  : ""}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {formatPayoutDate(payout.processedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">By Case</h2>
              <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-gray-200 bg-slate-50/90">
                      {["Case", "Client", "Payments", "Last Payment", "Received"].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                          >
                            {heading}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {earnings!.byCase.map((row) => (
                      <tr
                        key={row.caseId}
                        className="border-b border-gray-100 odd:bg-white even:bg-slate-50/30"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {row.caseTitle}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.clientName}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.paymentsCount}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.lastPaymentAt
                            ? new Date(row.lastPaymentAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#01411C]">
                          {formatCurrency(row.totalReceived)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <TransactionHistoryList
              transactions={recentTransactions}
              installmentLabelById={recentLabels}
            />
          </>
        )}
      </div>
    </LawyerLayout>
  );
}
