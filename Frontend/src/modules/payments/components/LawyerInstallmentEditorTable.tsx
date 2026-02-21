import type { Installment } from "../types/payments";
import PaymentStatusBadge from "./PaymentStatusBadge";
import { formatCurrency, getInstallmentStatus } from "../utils/paymentCalculations";

type LawyerInstallmentEditorTableProps = {
  installments: Installment[];
  canEdit: boolean;
  onUpdate: (
    installmentId: string,
    updates: Partial<Pick<Installment, "label" | "dueDate" | "amount">>
  ) => void;
  onDelete: (installmentId: string) => void;
};

export default function LawyerInstallmentEditorTable({
  installments,
  canEdit,
  onUpdate,
  onDelete,
}: LawyerInstallmentEditorTableProps) {
  if (installments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
        No installments added yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-[760px]">
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
              Paid
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
          {installments.map((item) => (
            <tr
              key={item.id}
              className="border-b border-gray-100 transition-colors odd:bg-white even:bg-slate-50/30 hover:bg-slate-50"
            >
              <td className="px-4 py-3 text-sm">
                {canEdit ? (
                  <input
                    value={item.label}
                    onChange={(event) =>
                      onUpdate(item.id, { label: event.target.value })
                    }
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                ) : (
                  <span className="font-medium text-gray-900">{item.label}</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm">
                {canEdit ? (
                  <input
                    type="date"
                    value={item.dueDate}
                    onChange={(event) =>
                      onUpdate(item.id, { dueDate: event.target.value })
                    }
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                ) : (
                  new Date(item.dueDate).toLocaleDateString()
                )}
              </td>
              <td className="px-4 py-3 text-sm">
                {canEdit ? (
                  <input
                    type="number"
                    min={0}
                    value={item.amount}
                    onChange={(event) =>
                      onUpdate(item.id, {
                        amount: Number(event.target.value || 0),
                      })
                    }
                    className="w-32 rounded-lg border border-gray-200 px-2.5 py-1.5 shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                ) : (
                  formatCurrency(item.amount)
                )}
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">
                {formatCurrency(item.paidAmount)}
              </td>
              <td className="px-4 py-3 text-sm">
                <PaymentStatusBadge status={getInstallmentStatus(item)} />
              </td>
              <td className="px-4 py-3 text-sm">
                {canEdit ? (
                  <button
                    onClick={() => onDelete(item.id)}
                    className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Remove
                  </button>
                ) : (
                  <span className="text-xs text-gray-500">Locked</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
