import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader } from "lucide-react";
import { createPaymentPlan, getLawyerCasePaymentContext } from "../api";
import { useQueryClient } from "@tanstack/react-query";

type PaymentPlanSetupProps = {
  caseId: string;
  context: Awaited<ReturnType<typeof getLawyerCasePaymentContext>>;
};

// Format a Date as a local YYYY-MM-DD (what <input type="date"> expects), without
// the UTC shift that toISOString() can introduce near midnight.
function toYMD(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function PaymentPlanSetup({ caseId, context }: PaymentPlanSetupProps) {
  const queryClient = useQueryClient();
  // Pre-fill the total with the lawyer's configured case charge for this
  // category; the lawyer can adjust it. This single total is what the client
  // pays (split into installments) — there is no separate service charge.
  const [totalAmount, setTotalAmount] = useState(
    context.categoryFee ? String(context.categoryFee) : ""
  );
  const [installmentCount, setInstallmentCount] = useState("6");
  // Lawyer-edited due dates keyed by installment index. Anything not edited
  // falls back to the monthly default, so we never need a reset-on-change effect.
  const [dueDateOverrides, setDueDateOverrides] = useState<Record<number, string>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryLabel =
    context.case.caseCategory === "family"
      ? "Family"
      : context.case.caseCategory === "civil"
        ? "Civil"
        : context.case.caseCategory;

  const todayYMD = toYMD(new Date());

  // The default schedule: equal whole-rupee amounts (last absorbs the remainder)
  // with month-by-month due dates — mirrors the backend so the preview matches
  // exactly. The lawyer edits only the dates.
  const schedule = useMemo(() => {
    const total = parseFloat(totalAmount);
    const count = parseInt(installmentCount, 10);
    if (!total || total <= 0 || !count || count < 1 || count > 48) return [];
    const perInstallment = Math.floor(total / count);
    const now = new Date();
    const rows: { number: number; amount: number; defaultDate: string }[] = [];
    let allocated = 0;
    for (let i = 1; i <= count; i += 1) {
      const amount =
        i === count
          ? Math.round((total - allocated) * 100) / 100
          : perInstallment;
      allocated = Math.round((allocated + amount) * 100) / 100;
      const due = new Date(now.getFullYear(), now.getMonth() + i, now.getDate());
      rows.push({ number: i, amount, defaultDate: toYMD(due) });
    }
    return rows;
  }, [totalAmount, installmentCount]);

  const dueDateFor = (index: number) =>
    dueDateOverrides[index] || schedule[index]?.defaultDate || "";

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

    const installments = schedule.map((_row, index) => ({
      dueDate: dueDateFor(index),
    }));

    // Catch obvious date mistakes before hitting the server.
    if (installments.some((item) => !item.dueDate)) {
      setError("Every installment needs a due date.");
      return;
    }
    if (installments.some((item) => item.dueDate < todayYMD)) {
      setError("Due dates cannot be in the past.");
      return;
    }
    if (new Set(installments.map((i) => i.dueDate)).size !== installments.length) {
      setError("Each installment must have a different due date.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await createPaymentPlan(caseId, {
        totalAmount: total,
        installmentCount: count,
        installments,
      });
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

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Payment Plan Setup
      </p>
      <p className="mt-1 text-sm text-gray-600">
        The total is pre-filled from your configured case charge — adjust it if
        you agreed a different fee with the client. It's split equally into
        installments (due dates default month-by-month, editable below). This
        total is the entire amount the client pays — there is no separate charge.
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

      {schedule.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Installment Schedule
            </h3>
            <span className="text-xs text-gray-500">
              Amounts are split equally; edit the due dates as needed.
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="bg-[#01411C] text-left text-xs font-semibold uppercase tracking-wide text-white">
                  <th className="px-4 py-2.5">Installment</th>
                  <th className="px-4 py-2.5">Amount (PKR)</th>
                  <th className="px-4 py-2.5">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row, index) => (
                  <tr
                    key={row.number}
                    className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-slate-50/30"
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      Installment {row.number}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {row.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="date"
                        min={todayYMD}
                        value={dueDateFor(index)}
                        onChange={(event) =>
                          setDueDateOverrides((prev) => ({
                            ...prev,
                            [index]: event.target.value,
                          }))
                        }
                        className="rounded-lg border border-gray-300 px-2.5 py-1.5 focus:border-[#01411C] focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
