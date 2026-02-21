import { useState } from "react";
import type { Receipt } from "../types/payments";
import { formatCurrency } from "../utils/paymentCalculations";
import { getPaymentMethodLabel } from "../utils/paymentGatewayMock";
import ReceiptDetailsModal from "./ReceiptDetailsModal";

type ReceiptsListProps = {
  receipts: Receipt[];
  installmentLabelById?: Record<string, string>;
  caseDisplayTitle?: string;
};

export default function ReceiptsList({
  receipts,
  installmentLabelById = {},
  caseDisplayTitle = "Case Payment",
}: ReceiptsListProps) {
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900">Receipts</h3>
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
                <tr className="border-b border-gray-200 bg-slate-50/90">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Receipt No
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Case
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Issued At
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Installment
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Method
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Amount
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
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
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </>
  );
}
