import { useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { BadgeCheck, FileSpreadsheet, HandCoins, Scale } from "lucide-react";
import LawyerLayout from "../../lawyer/components/LawyerLayout";
import { lawyerDashboardCases } from "../../lawyer/data/dashboard.mock";
import LawyerInstallmentEditorTable from "../components/LawyerInstallmentEditorTable";
import PaymentStatusBadge from "../components/PaymentStatusBadge";
import PaymentSummaryCard from "../components/PaymentSummaryCard";
import ReceiptsList from "../components/ReceiptsList";
import TransactionHistoryList from "../components/TransactionHistoryList";
import { usePaymentsStore } from "../store/payments.store";
import {
  formatCurrency,
  getInstallmentsTotal,
  getPlanTotals,
  isInstallmentsTotalValid,
} from "../utils/paymentCalculations";

type AgreementForm = {
  lawyerBaseFee: number;
  agreedTotal: number;
  agreedAt: string;
  notes: string;
};

function getCaseLabel(caseId: string): string {
  const found = lawyerDashboardCases.find((item) => String(item.id) === caseId);
  if (!found) return "Case";
  return found.title;
}

export default function LawyerCasePaymentPlanPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { caseId?: string };

  const {
    agreements,
    plans,
    receipts,
    transactions,
    upsertAgreement,
    createDraftPlan,
    updatePlanTotal,
    addInstallment,
    updateInstallment,
    deleteInstallment,
    activatePlan,
    cancelPlan,
  } = usePaymentsStore();

  const selectedCaseId = params.caseId || "1";
  const [agreementDrafts, setAgreementDrafts] = useState<
    Record<string, AgreementForm>
  >({});
  const [newInstallment, setNewInstallment] = useState({
    label: "",
    dueDate: "",
    amount: 0,
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [agreementFeedback, setAgreementFeedback] = useState<string | null>(null);

  const casePlans = useMemo(
    () =>
      plans
        .filter((item) => item.caseId === selectedCaseId)
        .sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ),
    [plans, selectedCaseId]
  );

  const plan = casePlans[0] || null;

  const agreement = useMemo(
    () => agreements.find((item) => item.caseId === selectedCaseId) || null,
    [agreements, selectedCaseId]
  );

  const caseReceipts = useMemo(
    () => receipts.filter((item) => item.caseId === selectedCaseId),
    [receipts, selectedCaseId]
  );

  const caseTransactions = useMemo(
    () => transactions.filter((item) => item.caseId === selectedCaseId),
    [transactions, selectedCaseId]
  );
  const fallbackAgreedAt = useMemo(
    () => new Date().toISOString().slice(0, 16),
    []
  );
  const installmentLabelById = useMemo(
    () =>
      casePlans.reduce<Record<string, string>>((acc, currentPlan) => {
        currentPlan.installments.forEach((installment) => {
          acc[installment.id] = installment.label;
        });
        return acc;
      }, {}),
    [casePlans]
  );

  const defaultAgreementForm: AgreementForm = useMemo(
    () =>
      agreement
        ? {
            lawyerBaseFee: agreement.lawyerBaseFee || 0,
            agreedTotal: agreement.agreedTotal,
            agreedAt: agreement.agreedAt
              ? new Date(agreement.agreedAt).toISOString().slice(0, 16)
              : fallbackAgreedAt,
            notes: agreement.notes || "",
          }
        : {
            lawyerBaseFee: 0,
            agreedTotal: 0,
            agreedAt: fallbackAgreedAt,
            notes: "",
          },
    [agreement, fallbackAgreedAt]
  );

  const agreementForm = agreementDrafts[selectedCaseId] || defaultAgreementForm;

  const setAgreementForm = (updater: (prev: AgreementForm) => AgreementForm) => {
    setAgreementFeedback(null);
    setAgreementDrafts((prev) => ({
      ...prev,
      [selectedCaseId]: updater(prev[selectedCaseId] || defaultAgreementForm),
    }));
  };

  const resetAgreementDraftForCase = () => {
    setAgreementDrafts((prev) => {
      const next = { ...prev };
      delete next[selectedCaseId];
      return next;
    });
  };

  const currentAgreementSnapshot: AgreementForm = agreement
    ? {
      lawyerBaseFee: agreement.lawyerBaseFee || 0,
      agreedTotal: agreement.agreedTotal,
      agreedAt: agreement.agreedAt
        ? new Date(agreement.agreedAt).toISOString().slice(0, 16)
        : fallbackAgreedAt,
      notes: agreement.notes || "",
    }
    : {
      lawyerBaseFee: 0,
      agreedTotal: 0,
      agreedAt: fallbackAgreedAt,
      notes: "",
    };

  const installmentTotal = plan ? getInstallmentsTotal(plan.installments) : 0;
  const totals = plan ? getPlanTotals(plan) : { total: 0, paid: 0, remaining: 0 };
  const isDraft = plan?.status === "draft";
  const isValidTotal = plan
    ? isInstallmentsTotalValid(plan.installments, plan.totalAmount)
    : false;

  const handleSaveAgreement = () => {
    const parsedAgreedAt = agreementForm.agreedAt
      ? new Date(agreementForm.agreedAt)
      : null;
    if (parsedAgreedAt && Number.isNaN(parsedAgreedAt.getTime())) {
      setAgreementFeedback("Please select a valid agreement date/time.");
      return;
    }

    upsertAgreement(selectedCaseId, {
      lawyerBaseFee: agreementForm.lawyerBaseFee,
      agreedTotal: agreementForm.agreedTotal,
      agreedAt: parsedAgreedAt
        ? parsedAgreedAt.toISOString()
        : agreement?.agreedAt,
      notes: agreementForm.notes,
    });

    if (plan?.status === "draft") {
      updatePlanTotal(plan.id, agreementForm.agreedTotal);
    }

    resetAgreementDraftForCase();
    setAgreementFeedback("Agreement snapshot saved.");
    setFeedback("Agreement snapshot saved.");
  };

  const handleCreateDraftPlan = () => {
    const planId = createDraftPlan(selectedCaseId);
    if (agreementForm.agreedTotal > 0) {
      updatePlanTotal(planId, agreementForm.agreedTotal);
    }
    setFeedback("Draft payment plan created.");
  };

  const handleActivatePlan = () => {
    if (!plan) return;
    const result = activatePlan(plan.id);
    setFeedback(result.ok ? "Plan activated for client view." : result.error || "Failed.");
  };

  const handleAddInstallment = () => {
    if (!plan || !isDraft) return;
    if (!newInstallment.label.trim() || !newInstallment.dueDate || newInstallment.amount <= 0) {
      setFeedback("Fill installment label, due date, and valid amount.");
      return;
    }

    addInstallment(plan.id, newInstallment);
    setNewInstallment({ label: "", dueDate: "", amount: 0 });
    setFeedback("Installment added.");
  };

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle="Case Payment Plans">
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/30 to-white p-6 shadow-[0_18px_50px_-34px_rgba(16,185,129,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <HandCoins className="h-3.5 w-3.5" />
                Payment Planning
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-gray-900">Case Payment Plan</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage agreement snapshots, installments, and activation.
              </p>
            </div>

            <select
              value={selectedCaseId}
              onChange={(event) => {
                const caseId = event.target.value;
                navigate({ to: `/lawyer-case-payments/${caseId}` });
              }}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              {lawyerDashboardCases.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                <Scale className="h-3.5 w-3.5" />
                Negotiated Agreement
              </div>
              <h2 className="mt-2 text-lg font-semibold text-gray-900">Agreement Snapshot</h2>
              <p className="text-sm text-gray-600">
                Final negotiated amount for {getCaseLabel(selectedCaseId)}.
              </p>
            </div>
            {plan && <PaymentStatusBadge status={plan.status} />}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Lawyer Base Fee
              </label>
              <input
                type="number"
                min={0}
                value={agreementForm.lawyerBaseFee}
                onChange={(event) =>
                  setAgreementForm((prev) => ({
                    ...prev,
                    lawyerBaseFee: Number(event.target.value || 0),
                  }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Agreed Total
              </label>
              <input
                type="number"
                min={0}
                value={agreementForm.agreedTotal}
                onChange={(event) =>
                  setAgreementForm((prev) => ({
                    ...prev,
                    agreedTotal: Number(event.target.value || 0),
                  }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Agreed At
              </label>
              <input
                type="datetime-local"
                value={agreementForm.agreedAt}
                onChange={(event) =>
                  setAgreementForm((prev) => ({
                    ...prev,
                    agreedAt: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Notes
            </label>
            <textarea
              value={agreementForm.notes}
              onChange={(event) =>
                setAgreementForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleSaveAgreement}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23]"
            >
              <BadgeCheck className="h-4 w-4" />
              Save Agreement
            </button>
            <button
              onClick={resetAgreementDraftForCase}
              disabled={
                agreementForm.lawyerBaseFee === currentAgreementSnapshot.lawyerBaseFee &&
                agreementForm.agreedTotal === currentAgreementSnapshot.agreedTotal &&
                agreementForm.notes === currentAgreementSnapshot.notes
              }
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset
            </button>
            {!plan && (
              <button
                onClick={handleCreateDraftPlan}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Create Draft Plan
              </button>
            )}
            {plan && plan.status !== "draft" && (
              <button
                onClick={handleCreateDraftPlan}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Create Draft Revision
              </button>
            )}
          </div>

          {agreementFeedback && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {agreementFeedback}
            </div>
          )}
        </div>

        {plan && (
          <>
            <PaymentSummaryCard
              total={totals.total}
              paid={totals.paid}
              remaining={totals.remaining}
            />

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Installments</h2>
                  <p className="text-sm text-gray-600">
                    Installment sum must match {formatCurrency(plan.totalAmount)} before activation.
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-gray-800">
                    Total: {formatCurrency(installmentTotal)}
                  </p>
                  <p className={isValidTotal ? "text-emerald-700" : "text-rose-700"}>
                    {isValidTotal
                      ? "Installment total is valid."
                      : `Difference: ${formatCurrency(plan.totalAmount - installmentTotal)}`}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <LawyerInstallmentEditorTable
                  installments={plan.installments}
                  canEdit={isDraft}
                  onUpdate={(installmentId, updates) =>
                    updateInstallment(plan.id, installmentId, updates)
                  }
                  onDelete={(installmentId) => deleteInstallment(plan.id, installmentId)}
                />
              </div>

              {isDraft && (
                <div className="mt-4 grid gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 md:grid-cols-4">
                  <input
                    value={newInstallment.label}
                    onChange={(event) =>
                      setNewInstallment((prev) => ({
                        ...prev,
                        label: event.target.value,
                      }))
                    }
                    placeholder="Installment label"
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  <input
                    type="date"
                    value={newInstallment.dueDate}
                    onChange={(event) =>
                      setNewInstallment((prev) => ({
                        ...prev,
                        dueDate: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  <input
                    type="number"
                    min={0}
                    value={newInstallment.amount}
                    onChange={(event) =>
                      setNewInstallment((prev) => ({
                        ...prev,
                        amount: Number(event.target.value || 0),
                      }))
                    }
                    placeholder="Amount"
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  <button
                    onClick={handleAddInstallment}
                    className="rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23]"
                  >
                    Add Installment
                  </button>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {plan.status === "draft" && (
                  <button
                    onClick={handleActivatePlan}
                    disabled={!isValidTotal || plan.installments.length === 0}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    Activate Plan
                  </button>
                )}
                {plan.status !== "cancelled" && plan.status !== "completed" && (
                  <button
                    onClick={() => cancelPlan(plan.id)}
                    className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Cancel Plan
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        <TransactionHistoryList
          transactions={caseTransactions}
          installmentLabelById={installmentLabelById}
        />
        <ReceiptsList
          receipts={caseReceipts}
          installmentLabelById={installmentLabelById}
          caseDisplayTitle={getCaseLabel(selectedCaseId)}
        />

        {feedback && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {feedback}
          </div>
        )}
      </div>
    </LawyerLayout>
  );
}
