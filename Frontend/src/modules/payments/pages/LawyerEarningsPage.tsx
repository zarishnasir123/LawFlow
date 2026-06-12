import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, HandCoins, Receipt } from "lucide-react";
import LawyerLayout from "../../lawyer/components/LawyerLayout";
import TransactionHistoryList from "../components/TransactionHistoryList";
import { getLawyerEarnings } from "../api";
import type { PaymentTransaction } from "../types/payments";
import { formatCurrency } from "../utils/paymentCalculations";

function installmentLabel(installmentNumber?: number): string {
  if (installmentNumber === 0) return "Service Charge";
  if (typeof installmentNumber === "number" && installmentNumber > 0) {
    return `Installment #${installmentNumber}`;
  }
  return "Installment";
}

export default function LawyerEarningsPage() {
  const { data: earnings, isLoading } = useQuery({
    queryKey: ["lawyer-earnings"],
    queryFn: getLawyerEarnings,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

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
            Payments your clients have made against their installment plans. The
            money is settled to your bank account through your normal banking;
            this page is your record of what has been received.
          </p>
        </div>

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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                  <HandCoins className="h-4 w-4 text-[#01411C]" />
                  Total Received
                </div>
                <p className="mt-2 text-3xl font-semibold text-[#01411C]">
                  {formatCurrency(earnings!.totalReceived)}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                  <Receipt className="h-4 w-4 text-[#01411C]" />
                  Payments
                </div>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {earnings!.paymentsCount}
                </p>
              </div>
            </div>

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
