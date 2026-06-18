import { formatCurrency } from "../utils/paymentCalculations";

type PaymentSummaryCardProps = {
  total: number;
  paid: number;
  remaining: number;
};

export default function PaymentSummaryCard({
  total,
  paid,
  remaining,
}: PaymentSummaryCardProps) {
  const progress = total > 0 ? Math.min(100, (paid / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Payment Summary
        </p>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
          {Math.round(progress)}% paid
        </span>
      </div>

      {/* Balance tiles — mirrors the receipt's Agreed Total / Paid / Remaining block */}
      <div className="mt-4 grid overflow-hidden rounded-xl border border-emerald-100 sm:grid-cols-3">
        <div className="border-b border-emerald-100 bg-[#f4fbf7] p-4 text-center sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Agreed Total
          </p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {formatCurrency(total)}
          </p>
        </div>
        <div className="border-b border-emerald-100 bg-[#f4fbf7] p-4 text-center sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Paid To Date
          </p>
          <p className="mt-1 text-lg font-bold text-emerald-700">
            {formatCurrency(paid)}
          </p>
        </div>
        <div className="bg-[#f4fbf7] p-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Remaining
          </p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {formatCurrency(remaining)}
          </p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-emerald-100">
        <div
          className="h-full rounded-full bg-[#01411C] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
