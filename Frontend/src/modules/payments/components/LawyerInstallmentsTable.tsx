import PaymentStatusBadge from "./PaymentStatusBadge";

type Row = {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: string | null;
  status: "pending" | "paid" | "overdue" | "cancelled";
};

type LawyerInstallmentsTableProps = {
  installments: Row[];
};

export default function LawyerInstallmentsTable({
  installments,
}: LawyerInstallmentsTableProps) {
  if (installments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
        No installments yet. Create a payment plan above.
      </div>
    );
  }

  const paidCount = installments.filter((i) => i.status === "paid").length;
  const progress =
    installments.length > 0
      ? Math.min(100, (paidCount / installments.length) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Payment progress</span>
          <span className="text-gray-600">{Math.round(progress)}% paid</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
          <div
            className="h-full rounded-full bg-[#01411C] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-[#01411C]">
              {["Installment", "Due Date", "Amount", "Status"].map((heading) => (
                <th
                  key={heading}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {installments.map((item) => (
              <tr
                key={item.id}
                className="border-b border-gray-100 odd:bg-white even:bg-slate-50/30"
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {item.installmentNumber === 0
                    ? "Service Charge"
                    : `#${item.installmentNumber}`}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {item.dueDate
                    ? new Date(item.dueDate).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                  PKR {item.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <PaymentStatusBadge
                    status={
                      item.status === "paid"
                        ? "paid"
                        : item.status === "overdue"
                          ? "overdue"
                          : "pending"
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
