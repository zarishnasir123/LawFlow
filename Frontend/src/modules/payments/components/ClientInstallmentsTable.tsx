import { ArrowUpRight, Loader2 } from "lucide-react";
import { useState } from "react";
import type { Installment } from "../types/payments";
import { formatCurrency, getInstallmentStatus } from "../utils/paymentCalculations";
import PaymentStatusBadge from "./PaymentStatusBadge";
import { createCheckoutSession } from "../api";

type ClientInstallmentsTableProps = {
  installments: Installment[];
  caseName?: string;
};

export default function ClientInstallmentsTable({
  installments,
  caseName = "Case",
}: ClientInstallmentsTableProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSafepayCheckout = async (installment: Installment) => {
    try {
      setLoadingId(installment.id);
      setError(null);

      const session = await createCheckoutSession({
        installmentId: installment.id,
        amount: installment.amount,
        caseName,
      });

      if (session?.sessionUrl) {
        window.location.assign(session.sessionUrl);
      } else {
        setError("Failed to start payment. Please try again.");
      }
    } catch {
      setError("Failed to initiate payment. Please try again.");
    } finally {
      setLoadingId(null);
    }
  };

  if (installments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
        No installment schedule available yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-[#01411C]">
              {["Installment", "Due Date", "Amount", "Status", "Action"].map(
                (heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white"
                  >
                    {heading}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {installments.map((item) => {
              const status = getInstallmentStatus(item);
              const canPay = status === "pending" || status === "overdue";

              return (
                <tr
                  key={item.id}
                  className="border-b border-gray-100 odd:bg-white even:bg-slate-50/30"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {item.label}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {new Date(item.dueDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <PaymentStatusBadge
                      status={
                        status === "paid"
                          ? "paid"
                          : status === "overdue"
                            ? "overdue"
                            : "pending"
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    {canPay ? (
                      <button
                        type="button"
                        onClick={() => handleSafepayCheckout(item)}
                        disabled={loadingId === item.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#01411C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#024a23] disabled:opacity-60"
                      >
                        {loadingId === item.id ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing…
                          </>
                        ) : (
                          <>
                            Pay Now
                            <ArrowUpRight className="h-3 w-3" />
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-700">Paid</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
