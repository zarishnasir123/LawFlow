import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  LockKeyhole,
  ArrowUpRight,
} from "lucide-react";
import type { Installment } from "../types/payments";
import {
  formatCurrency,
  getInstallmentRemainingAmount,
} from "../utils/paymentCalculations";
import { createCheckoutSession } from "../api";
import type { PaymentMethod } from "../types/payments";

type PayInstallmentModalProps = {
  installment: Installment;
  onClose: () => void;
  onSubmit: (payload: { amount: number; method: PaymentMethod }) => {
    ok: boolean;
    error?: string;
  };
};

export default function PayInstallmentModal({
  installment,
  onClose,
  onSubmit,
}: PayInstallmentModalProps) {
  const remaining = getInstallmentRemainingAmount(installment);
  const [amount, setAmount] = useState(remaining);
  const method: PaymentMethod = "stripe";
  const [processing, setProcessing] = useState(false);
  const [paymentState, setPaymentState] = useState<{
    type: "idle" | "success" | "failed";
    message?: string;
  }>({ type: "idle" });

  const invalidAmount = amount <= 0 || amount > remaining;

  const handleConfirm = async () => {
    if (invalidAmount) {
      setPaymentState({
        type: "failed",
        message: `Enter a value between 1 and ${remaining}.`,
      });
      return;
    }

    setPaymentState({ type: "idle" });
    setProcessing(true);

    try {
      const session = await createCheckoutSession({
        installmentId: installment.id,
        amount,
        caseName: "Case payment",
      });

      if (!session?.sessionUrl) {
        setPaymentState({
          type: "failed",
          message: "Failed to create checkout session. Please try again.",
        });
        setProcessing(false);
        return;
      }

      const result = onSubmit({ amount, method });

      if (!result.ok) {
        setPaymentState({
          type: "failed",
          message: result.error || "Payment could not be completed.",
        });
        setProcessing(false);
        return;
      }

      setPaymentState({ type: "success", message: "Redirecting to Stripe..." });
      setTimeout(() => {
        window.location.href = session.checkoutUrl;
      }, 500);
    } catch (error) {
      console.error("Payment error:", error);
      setPaymentState({
        type: "failed",
        message: "An error occurred. Please try again.",
      });
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="border-b border-gray-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Complete Payment</h3>
              <p className="mt-1 text-sm text-gray-600">{installment.label} installment</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700">
              <LockKeyhole className="h-3.5 w-3.5" />
              Stripe Secure
            </div>
          </div>
        </div>
        <div className="space-y-6 p-6">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
            <p className="text-gray-700">
              Installment Amount:{" "}
              <span className="font-semibold text-gray-900">
                {formatCurrency(installment.amount)}
              </span>
            </p>
            <p className="mt-1 text-gray-700">
              Remaining:{" "}
              <span className="font-semibold text-gray-900">
                {formatCurrency(remaining)}
              </span>
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Payment Amount
            </label>
            <input
              type="number"
              min={0}
              max={remaining}
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value || 0))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-lg font-semibold focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {invalidAmount && (
              <p className="mt-1 text-xs text-rose-600">
                Enter a value between 1 and {remaining}.
              </p>
            )}
          </div>

          {paymentState.type !== "idle" && (
            <div
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                paymentState.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {paymentState.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4" />
              )}
              <span>{paymentState.message}</span>
            </div>
          )}

          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-xs text-sky-700">
            <p className="font-semibold">Stripe Secure Checkout</p>
            <p className="mt-1">
              You will be redirected to Stripe's secure payment page. Your card details are never shared with us.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            disabled={processing}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={invalidAmount || processing}
            className="inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23] disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ArrowUpRight className="h-4 w-4" />
                Pay {formatCurrency(amount)} with Stripe
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
