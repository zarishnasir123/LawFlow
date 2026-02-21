import { CheckCircle2, CircleDollarSign, Wallet } from "lucide-react";
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
    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/30 to-white p-5 shadow-[0_20px_55px_-35px_rgba(16,185,129,0.35)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Payment Summary</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Track total fee, paid amount, and outstanding dues.
          </p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
          {Math.round(progress)}% paid
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-emerald-100">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4 text-slate-500" />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total
            </p>
          </div>
          <p className="mt-1 text-lg font-semibold text-slate-800">
            {formatCurrency(total)}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Paid
            </p>
          </div>
          <p className="mt-1 text-lg font-semibold text-emerald-800">
            {formatCurrency(paid)}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-amber-700" />
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Remaining
            </p>
          </div>
          <p className="mt-1 text-lg font-semibold text-amber-800">
            {formatCurrency(remaining)}
          </p>
        </div>
      </div>
    </div>
  );
}
