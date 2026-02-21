import { ArrowUpRight } from "lucide-react";
import type { Installment } from "../types/payments";
import {
  formatCurrency,
  getInstallmentRemainingAmount,
  getInstallmentStatus,
} from "../utils/paymentCalculations";
import PaymentStatusBadge from "./PaymentStatusBadge";

type ClientInstallmentsTableProps = {
  installments: Installment[];
  onPayNow: (installment: Installment) => void;
};

export default function ClientInstallmentsTable({
  installments,
  onPayNow,
}: ClientInstallmentsTableProps) {
  if (installments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
        No installment schedule available yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-[780px]">
        <thead>
          <tr className="border-b border-gray-200 bg-slate-50/90">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              Label
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              Due Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              Paid Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {installments.map((item) => {
            const status = getInstallmentStatus(item);
            const remaining = getInstallmentRemainingAmount(item);
            const canPay = status !== "paid" && remaining > 0;

            return (
              <tr
                key={item.id}
                className="border-b border-gray-100 transition-colors odd:bg-white even:bg-slate-50/30 hover:bg-slate-50"
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.label}</td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {new Date(item.dueDate).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {formatCurrency(item.amount)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {formatCurrency(item.paidAmount)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <PaymentStatusBadge status={status} />
                </td>
                <td className="px-4 py-3 text-sm">
                  {canPay ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onPayNow(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#01411C] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_10px_20px_-15px_rgba(1,65,28,0.85)] hover:bg-[#024a23]"
                      >
                        Pay Now
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                      <span className="text-xs text-gray-500">
                        Remaining {formatCurrency(remaining)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">No action</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
