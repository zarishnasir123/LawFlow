import type { PaymentTransaction } from "../types/payments";
import PaymentStatusBadge from "./PaymentStatusBadge";
import { formatCurrency } from "../utils/paymentCalculations";

type TransactionHistoryListProps = {
  transactions: PaymentTransaction[];
  installmentLabelById?: Record<string, string>;
};

export default function TransactionHistoryList({
  transactions,
  installmentLabelById = {},
}: TransactionHistoryListProps) {
  const formatMethod = (method: PaymentTransaction["method"]): string =>
    method
      .replace(/_/g, " ")
      .split(" ")
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ");

  const formatProvider = (provider?: PaymentTransaction["provider"]): string => {
    if (provider === "stripe") return "Stripe";
    return "Manual";
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {transactions.length} {transactions.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {transactions.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          No payment transactions yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-200 bg-slate-50/90">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Date
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Installment
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Method
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Provider
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Amount
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr
                  key={txn.id}
                  className="border-b border-gray-100 transition-colors odd:bg-white even:bg-slate-50/30 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 text-sm text-gray-700">
                    {new Date(txn.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700">
                    {installmentLabelById[txn.installmentId] || "Installment"}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700">
                    {formatMethod(txn.method)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700">
                    {formatProvider(txn.provider)}
                  </td>
                  <td className="px-3 py-2 text-sm font-semibold text-gray-900">
                    {formatCurrency(txn.amount)}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {txn.status === "success" ? (
                      <PaymentStatusBadge status="paid" />
                    ) : (
                      <PaymentStatusBadge status="overdue" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
