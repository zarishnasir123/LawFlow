import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader } from "lucide-react";
import { createPaymentPlan, getLawyerCasePaymentContext } from "../api";
import { useQueryClient } from "@tanstack/react-query";

type PaymentPlanSetupProps = {
  caseId: string;
  context: Awaited<ReturnType<typeof getLawyerCasePaymentContext>>;
};

export default function PaymentPlanSetup({ caseId, context }: PaymentPlanSetupProps) {
  const queryClient = useQueryClient();
  const [totalAmount, setTotalAmount] = useState("");
  const [installmentCount, setInstallmentCount] = useState("6");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryLabel =
    context.case.caseCategory === "family"
      ? "Family"
      : context.case.caseCategory === "civil"
        ? "Civil"
        : context.case.caseCategory;

  const handleCreate = async () => {
    const total = parseFloat(totalAmount);
    const count = parseInt(installmentCount, 10);

    if (!total || total <= 0) {
      setError("Enter a valid total case amount.");
      return;
    }
    if (!count || count < 1 || count > 48) {
      setError("Installments must be between 1 and 48.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await createPaymentPlan(caseId, { totalAmount: total, installmentCount: count });
      await queryClient.invalidateQueries({ queryKey: ["agreements", caseId] });
      await queryClient.refetchQueries({ queryKey: ["agreements", caseId] });
      await queryClient.invalidateQueries({
        queryKey: ["lawyer-payment-context", caseId],
      });
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : null;
      setError(message || "Failed to create installments. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (context.hasPaymentPlan) {
    return null;
  }

  if (!context.hasCategoryFee) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-medium text-amber-900">
              {categoryLabel} case charges not configured
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Set your {categoryLabel} case fee in Service Charges before creating a payment
              plan for this case.
            </p>
            <Link
              to="/lawyer-service-charges"
              className="mt-3 inline-block text-sm font-semibold text-[#01411C] underline"
            >
              Go to Service Charges →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const perInstallment =
    totalAmount && installmentCount
      ? Math.round((parseFloat(totalAmount) / parseInt(installmentCount, 10)) * 100) /
        100
      : 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Payment Plan Setup</h2>
      <p className="mt-1 text-sm text-gray-600">
        Configure total amount and installments. Due dates are generated monthly automatically.
      </p>

      <div className="mt-4 grid gap-4 rounded-xl border border-gray-100 bg-slate-50/80 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Client</p>
          <p className="mt-1 font-medium text-gray-900">{context.case.clientName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Case Title</p>
          <p className="mt-1 font-medium text-gray-900">{context.case.title}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Case Category</p>
          <p className="mt-1 font-medium capitalize text-gray-900">{categoryLabel}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Configured Case Charge</p>
          <p className="mt-1 text-lg font-bold text-[#01411C]">
            PKR {(context.categoryFee || 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Total Case Amount (PKR)
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-[#01411C] focus:outline-none focus:ring-2 focus:ring-emerald-100"
            placeholder="e.g. 3000"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Number of Installments
          </label>
          <input
            type="number"
            min={1}
            max={48}
            value={installmentCount}
            onChange={(e) => setInstallmentCount(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-[#01411C] focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      </div>

      {perInstallment > 0 && (
        <p className="mt-3 text-sm text-gray-600">
          Each installment ≈ PKR {perInstallment.toLocaleString()} (auto-calculated)
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      <button
        type="button"
        onClick={handleCreate}
        disabled={loading}
        className="mt-5 w-full rounded-lg bg-[#01411C] py-3 text-sm font-semibold text-white hover:bg-[#024a23] disabled:bg-gray-400 sm:w-auto sm:px-8"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader className="h-4 w-4 animate-spin" />
            Creating installments…
          </span>
        ) : (
          "Create Installments"
        )}
      </button>
    </div>
  );
}
