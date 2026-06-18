import { useState } from "react";
import type { Receipt } from "../types/payments";
import { formatCurrency } from "../utils/paymentCalculations";
import { getPaymentMethodLabel } from "../utils/paymentGatewayMock";
import ReceiptDetailsModal from "./ReceiptDetailsModal";

type ReceiptsListProps = {
  receipts: Receipt[];
  installmentLabelById?: Record<string, string>;
  caseDisplayTitle?: string;
  // Extra context for the printable receipt (the full agreement picture). All
  // optional so other callers keep working.
  caseTypeName?: string;
  agreedTotal?: number;
  totalPaid?: number;
};

export default function ReceiptsList({
  receipts,
  installmentLabelById = {},
  caseDisplayTitle = "Case Payment",
  caseTypeName,
  agreedTotal,
  totalPaid,
}: ReceiptsListProps) {
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Receipts
          </p>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {receipts.length} {receipts.length === 1 ? "receipt" : "receipts"}
          </span>
        </div>

        {receipts.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
            No receipts generated for this case yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="bg-[#01411C]">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white">
                    Receipt No
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white">
                    Case
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white">
                    Issued At
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white">
                    Installment
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white">
                    Method
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white">
                    Amount
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr
                    key={receipt.id}
                    className="border-b border-gray-100 transition-colors odd:bg-white even:bg-slate-50/30 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">
                      {receipt.receiptNo}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {caseDisplayTitle}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {new Date(receipt.issuedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {installmentLabelById[receipt.installmentId] || "Installment"}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {getPaymentMethodLabel(receipt.method)}
                    </td>
                    <td className="px-3 py-2 text-sm font-semibold text-gray-900">
                      {formatCurrency(receipt.amount)}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <button
                        onClick={() => setSelectedReceipt(receipt)}
                        className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                      >
                        View Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selectedReceipt && (
        <ReceiptDetailsModal
          receipt={selectedReceipt}
          caseDisplayTitle={caseDisplayTitle}
          installmentLabel={
            installmentLabelById[selectedReceipt.installmentId] || "Installment"
          }
          caseTypeName={caseTypeName}
          agreedTotal={agreedTotal}
          totalPaid={totalPaid}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </>
  );
}
