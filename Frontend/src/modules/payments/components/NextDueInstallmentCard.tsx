import { CalendarClock } from "lucide-react";
import type { Installment } from "../types/payments";
import {
  formatCurrency,
  getInstallmentRemainingAmount,
  getInstallmentStatus,
} from "../utils/paymentCalculations";
import PaymentStatusBadge from "./PaymentStatusBadge";

type NextDueInstallmentCardProps = {
  installment: Installment | null;
};

export default function NextDueInstallmentCard({
  installment,
}: NextDueInstallmentCardProps) {
  const status = installment ? getInstallmentStatus(installment) : null;
  const panelClass =
    status === "overdue"
      ? "border-rose-200 bg-gradient-to-br from-rose-50 to-white"
      : "border-slate-200 bg-gradient-to-br from-slate-50 to-white";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Next Due Installment</h3>
      <p className="mt-0.5 text-xs text-gray-500">
        Nearest unpaid installment based on due date.
      </p>

      {!installment ? (
        <div className="mt-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          No pending installments. All dues are settled.
        </div>
      ) : (
        <div className={`mt-4 rounded-xl border p-4 ${panelClass}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {installment.label}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
                <CalendarClock className="h-3.5 w-3.5" />
                Due on {new Date(installment.dueDate).toLocaleDateString()}
              </p>
            </div>
            <PaymentStatusBadge status={status || "pending"} />
          </div>
          <div className="mt-3 text-sm text-gray-700">
            Remaining:{" "}
            <span className="font-semibold">
              {formatCurrency(getInstallmentRemainingAmount(installment))}
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Installment amount: {formatCurrency(installment.amount)}
          </div>
        </div>
      )}
    </div>
  );
}
