import { useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { CalendarDays, CreditCard, WalletCards } from "lucide-react";
import ClientLayout from "../../client/components/ClientLayout";
import { lawyerDashboardCases } from "../../lawyer/data/dashboard.mock";
import ClientInstallmentsTable from "../components/ClientInstallmentsTable";
import NextDueInstallmentCard from "../components/NextDueInstallmentCard";
import PayInstallmentModal from "../components/PayInstallmentModal";
import PaymentStatusBadge from "../components/PaymentStatusBadge";
import PaymentSummaryCard from "../components/PaymentSummaryCard";
import ReceiptsList from "../components/ReceiptsList";
import TransactionHistoryList from "../components/TransactionHistoryList";
import { usePaymentsStore } from "../store/payments.store";
import { getNextDueInstallment, getPlanTotals } from "../utils/paymentCalculations";
import type { Installment, PaymentMethod } from "../types/payments";

function getCaseLabel(caseId: string): string {
  const found = lawyerDashboardCases.find((item) => String(item.id) === caseId);
  if (!found) return "Case";
  return found.title;
}

export default function ClientCasePaymentsPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { caseId?: string };

  const { plans, receipts, transactions, payInstallment } = usePaymentsStore();
  const visiblePlans = useMemo(
    () => plans.filter((plan) => plan.status === "active"),
    [plans]
  );

  const hasAnyPlans = plans.length > 0;
  const fallbackCaseId = visiblePlans[0]?.caseId || "1";
  const selectedCaseId =
    params.caseId && visiblePlans.some((item) => item.caseId === params.caseId)
      ? params.caseId
      : fallbackCaseId;
  const plan = visiblePlans.find((item) => item.caseId === selectedCaseId) || null;

  const totals = plan ? getPlanTotals(plan) : { total: 0, paid: 0, remaining: 0 };
  const nextDue = plan ? getNextDueInstallment(plan) : null;
  const caseReceipts = useMemo(
    () =>
      receipts.filter(
        (item) => item.caseId === selectedCaseId && (!plan || item.planId === plan.id)
      ),
    [plan, receipts, selectedCaseId]
  );
  const caseTransactions = useMemo(
    () =>
      transactions.filter(
        (item) => item.caseId === selectedCaseId && (!plan || item.planId === plan.id)
      ),
    [plan, selectedCaseId, transactions]
  );
  const installmentLabelById = useMemo(() => {
    if (!plan) return {};
    return plan.installments.reduce<Record<string, string>>((acc, installment) => {
      acc[installment.id] = installment.label;
      return acc;
    }, {});
  }, [plan]);

  const [payingInstallment, setPayingInstallment] = useState<Installment | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmitPayment = (payload: { amount: number; method: PaymentMethod }) => {
    if (!plan || !payingInstallment) {
      return { ok: false, error: "No installment selected." };
    }

    const result = payInstallment({
      caseId: selectedCaseId,
      planId: plan.id,
      installmentId: payingInstallment.id,
      amount: payload.amount,
      method: payload.method,
      provider: payload.method === "stripe" ? "stripe" : "manual",
      paymentIntentId:
        payload.method === "stripe" ? `pi_mock_${Date.now()}` : undefined,
      checkoutSessionId:
        payload.method === "stripe" ? `cs_mock_${Date.now()}` : undefined,
    });

    setFeedback(
      result.ok
        ? `Payment recorded. Receipt ${result.receipt?.receiptNo || ""} generated.`
        : result.error || "Payment failed."
    );

    if (result.ok) {
      setPayingInstallment(null);
    }

    return { ok: result.ok, error: result.error };
  };

  return (
    <ClientLayout brandSubtitle="Case Payments">
      <div className="space-y-6">
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-sky-50/40 to-white p-6 shadow-[0_20px_50px_-35px_rgba(14,165,233,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-sky-700">
                <WalletCards className="h-3.5 w-3.5" />
                Charges & Payments
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-gray-900">Payments</h1>
              <p className="mt-1 text-sm text-gray-600">
                View installment plan, pay dues, and access receipts.
              </p>
            </div>
            {visiblePlans.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                No active plans
              </div>
            ) : (
              <select
                value={selectedCaseId}
                onChange={(event) =>
                  navigate({ to: `/client-payments/${event.target.value}` })
                }
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                {visiblePlans.map((item) => (
                  <option key={item.id} value={item.caseId}>
                    {getCaseLabel(item.caseId)}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {!plan ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            {hasAnyPlans
              ? "No active payment plan is available right now. Please wait for the lawyer to activate a plan."
              : "No payment plan is available for this case yet."}
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-600">Plan for {getCaseLabel(plan.caseId)}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Agreed on {new Date(plan.agreement.agreedAt).toLocaleString()}
                  </p>
                </div>
                <PaymentStatusBadge status={plan.status} />
              </div>
            </div>

            <PaymentSummaryCard
              total={totals.total}
              paid={totals.paid}
              remaining={totals.remaining}
            />
            <NextDueInstallmentCard installment={nextDue} />

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Installments</h2>
              <p className="mt-1 text-sm text-gray-600">
                Pay pending dues with the secure Stripe-style flow.
              </p>
              <div className="mt-4">
                <ClientInstallmentsTable
                  installments={plan.installments}
                  onPayNow={(installment) => setPayingInstallment(installment)}
                />
              </div>
            </div>

            <TransactionHistoryList
              transactions={caseTransactions}
              installmentLabelById={installmentLabelById}
            />
            <ReceiptsList
              receipts={caseReceipts}
              installmentLabelById={installmentLabelById}
              caseDisplayTitle={getCaseLabel(selectedCaseId)}
            />
          </>
        )}

        {feedback && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <div className="flex items-start gap-2">
              <CreditCard className="mt-0.5 h-4 w-4" />
              <span>{feedback}</span>
            </div>
          </div>
        )}
      </div>

      {payingInstallment && (
        <PayInstallmentModal
          installment={payingInstallment}
          onClose={() => setPayingInstallment(null)}
          onSubmit={handleSubmitPayment}
        />
      )}
    </ClientLayout>
  );
}
