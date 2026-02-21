import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  LockKeyhole,
} from "lucide-react";
import type { Installment } from "../types/payments";
import {
  formatCurrency,
  getInstallmentRemainingAmount,
} from "../utils/paymentCalculations";
import {
  formatCardNumber,
  normalizeCvc,
  normalizeExpiry,
  simulateGatewayResult,
  validateStripeLikeFields,
} from "../utils/paymentGatewayMock";
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
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [processing, setProcessing] = useState(false);
  const [paymentState, setPaymentState] = useState<{
    type: "idle" | "success" | "declined" | "unavailable";
    message?: string;
  }>({ type: "idle" });

  const invalidAmount = amount <= 0 || amount > remaining;

  const handleConfirm = async () => {
    const validation = validateStripeLikeFields({
      method,
      amount,
      cardholderName,
      cardNumber,
      expiry,
      cvc,
    });
    if (!validation.valid) {
      setPaymentState({ type: "declined", message: validation.message });
      return;
    }
    if (invalidAmount) {
      setPaymentState({
        type: "declined",
        message: `Enter a value between 1 and ${remaining}.`,
      });
      return;
    }

    setPaymentState({ type: "idle" });
    setProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const mockGateway = simulateGatewayResult({
      method,
      amount,
      cardholderName,
      cardNumber,
      expiry,
      cvc,
    });

    if (mockGateway.outcome !== "success") {
      setProcessing(false);
      setPaymentState({
        type: mockGateway.outcome,
        message: mockGateway.message,
      });
      return;
    }

    const result = onSubmit({ amount, method });
    setProcessing(false);

    if (!result.ok) {
      setPaymentState({
        type: "declined",
        message: result.error || "Payment could not be completed.",
      });
      return;
    }

    setPaymentState({ type: "success", message: "Payment completed successfully." });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="border-b border-gray-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Complete Payment</h3>
              <p className="mt-1 text-sm text-gray-600">{installment.label} installment</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700">
              <LockKeyhole className="h-3.5 w-3.5" />
              Stripe
            </div>
          </div>
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
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
                Amount
              </label>
              <input
                type="number"
                min={0}
                max={remaining}
                value={amount}
                onChange={(event) => setAmount(Number(event.target.value || 0))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              {invalidAmount && (
                <p className="mt-1 text-xs text-rose-600">
                  Enter a value between 1 and {remaining}.
                </p>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
                <CreditCard className="h-4 w-4" />
                Card Details
              </div>
              <input
                value={cardholderName}
                onChange={(event) => setCardholderName(event.target.value)}
                placeholder="Cardholder name"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={cardNumber}
                onChange={(event) => setCardNumber(formatCardNumber(event.target.value))}
                placeholder="4242 4242 4242 4242"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={expiry}
                  onChange={(event) => setExpiry(normalizeExpiry(event.target.value))}
                  placeholder="MM/YY"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <input
                  value={cvc}
                  onChange={(event) => setCvc(normalizeCvc(event.target.value))}
                  placeholder="CVC"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Test cards</p>
              <p className="mt-2">
                Use card ending <code>0002</code> for declined.
              </p>
              <p className="mt-1">
                Use card ending <code>9999</code> for service unavailable.
              </p>
              <p className="mt-1">
                Any other valid 16-digit card returns success.
              </p>
            </div>

            {paymentState.type !== "idle" && (
              <div
                className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                  paymentState.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : paymentState.type === "unavailable"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
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
              `Pay ${formatCurrency(amount)}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
