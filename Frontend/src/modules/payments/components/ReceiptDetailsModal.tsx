import type { Receipt } from "../types/payments";
import { formatCurrency } from "../utils/paymentCalculations";
import { getPaymentMethodLabel } from "../utils/paymentGatewayMock";

type ReceiptDetailsModalProps = {
  receipt: Receipt;
  caseDisplayTitle: string;
  installmentLabel: string;
  onClose: () => void;
};

export default function ReceiptDetailsModal({
  receipt,
  caseDisplayTitle,
  installmentLabel,
  onClose,
}: ReceiptDetailsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="mb-4 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Official Receipt
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            Document generated for payment confirmation.
          </p>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Payment Receipt</h3>
            <p className="mt-1 text-sm text-gray-500">{receipt.receiptNo}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Case</p>
            <p className="text-sm font-semibold text-gray-900">{caseDisplayTitle}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Installment</p>
            <p className="text-sm font-semibold text-gray-900">{installmentLabel}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Amount Paid</p>
              <p className="text-sm font-semibold text-gray-900">
                {formatCurrency(receipt.amount)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Method</p>
              <p className="text-sm font-semibold text-gray-900">
                {getPaymentMethodLabel(receipt.method)}
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Issued At</p>
            <p className="text-sm font-semibold text-gray-900">
              {new Date(receipt.issuedAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
