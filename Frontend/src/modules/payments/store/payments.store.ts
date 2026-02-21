import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  paymentAgreementsMock,
  paymentPlansMock,
  paymentReceiptsMock,
  paymentTransactionsMock,
} from "../data/paymentPlans.mock";
import {
  derivePlanStatus,
  getInstallmentRemainingAmount,
  isInstallmentsTotalValid,
} from "../utils/paymentCalculations";
import type {
  Agreement,
  Installment,
  PaymentMethod,
  PaymentPlan,
  PaymentProvider,
  PaymentTransaction,
  Receipt,
} from "../types/payments";

type AgreementInput = {
  agreedTotal: number;
  agreedAt?: string;
  notes?: string;
  lawyerBaseFee?: number;
};

type NewInstallmentInput = {
  label: string;
  dueDate: string;
  amount: number;
};

type PayInstallmentInput = {
  caseId: string;
  planId: string;
  installmentId: string;
  amount: number;
  method: PaymentMethod;
  provider?: PaymentProvider;
  paymentIntentId?: string;
  checkoutSessionId?: string;
};

interface PaymentsState {
  agreements: Agreement[];
  plans: PaymentPlan[];
  receipts: Receipt[];
  transactions: PaymentTransaction[];

  upsertAgreement: (caseId: string, agreement: AgreementInput) => void;
  createDraftPlan: (caseId: string) => string;
  updatePlanTotal: (planId: string, totalAmount: number) => void;
  addInstallment: (planId: string, installment: NewInstallmentInput) => void;
  updateInstallment: (
    planId: string,
    installmentId: string,
    updates: Partial<Pick<Installment, "label" | "dueDate" | "amount">>
  ) => void;
  deleteInstallment: (planId: string, installmentId: string) => void;
  activatePlan: (planId: string) => { ok: boolean; error?: string };
  cancelPlan: (planId: string) => void;
  payInstallment: (input: PayInstallmentInput) => {
    ok: boolean;
    error?: string;
    receipt?: Receipt;
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeMoney(value: number): number {
  return Number(value.toFixed(2));
}

function createReceiptNo(existingCount: number): string {
  const year = new Date().getFullYear();
  return `RCPT-${year}-${String(existingCount + 1).padStart(5, "0")}`;
}

export const usePaymentsStore = create<PaymentsState>()(
  persist(
    (set, get) => ({
      agreements: paymentAgreementsMock,
      plans: paymentPlansMock,
      receipts: paymentReceiptsMock,
      transactions: paymentTransactionsMock,

      upsertAgreement: (caseId, agreementInput) => {
        const timestamp = nowIso();
        const agreement: Agreement = {
          caseId,
          agreedTotal: normalizeMoney(agreementInput.agreedTotal),
          agreedAt: agreementInput.agreedAt || timestamp,
          notes: agreementInput.notes?.trim() || undefined,
          lawyerBaseFee: agreementInput.lawyerBaseFee,
        };

        set((state) => {
          const agreements = state.agreements.some((item) => item.caseId === caseId)
            ? state.agreements.map((item) => (item.caseId === caseId ? agreement : item))
            : [...state.agreements, agreement];

          const plans = state.plans.map((plan) =>
            plan.caseId === caseId && plan.status === "draft"
              ? {
                  ...plan,
                  agreement,
                  totalAmount: agreement.agreedTotal,
                  updatedAt: timestamp,
                }
              : plan
          );

          return { agreements, plans };
        });
      },

      createDraftPlan: (caseId) => {
        const current = get();
        const existingDraft = current.plans.find(
          (plan) => plan.caseId === caseId && plan.status === "draft"
        );
        if (existingDraft) return existingDraft.id;

        const agreement =
          current.agreements.find((item) => item.caseId === caseId) ||
          ({
            caseId,
            agreedTotal: 0,
            agreedAt: nowIso(),
          } as Agreement);

        const id = createId("plan");
        const timestamp = nowIso();
        const newPlan: PaymentPlan = {
          id,
          caseId,
          agreement,
          totalAmount: agreement.agreedTotal,
          status: "draft",
          installments: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        set((state) => ({ plans: [newPlan, ...state.plans] }));
        return id;
      },

      updatePlanTotal: (planId, totalAmount) => {
        const normalizedTotal = normalizeMoney(Math.max(0, totalAmount));
        const timestamp = nowIso();

        set((state) => ({
          plans: state.plans.map((plan) =>
            plan.id === planId && plan.status === "draft"
              ? {
                  ...plan,
                  totalAmount: normalizedTotal,
                  agreement: {
                    ...plan.agreement,
                    agreedTotal: normalizedTotal,
                  },
                  updatedAt: timestamp,
                }
              : plan
          ),
          agreements: state.agreements.map((agreement) =>
            state.plans.some((plan) => plan.id === planId && plan.caseId === agreement.caseId)
              ? { ...agreement, agreedTotal: normalizedTotal }
              : agreement
          ),
        }));
      },

      addInstallment: (planId, installmentInput) => {
        const timestamp = nowIso();
        set((state) => ({
          plans: state.plans.map((plan) => {
            if (plan.id !== planId || plan.status !== "draft") return plan;

            const installment: Installment = {
              id: createId("inst"),
              planId,
              label: installmentInput.label.trim() || "Installment",
              dueDate: installmentInput.dueDate,
              amount: normalizeMoney(Math.max(0, installmentInput.amount)),
              paidAmount: 0,
              createdAt: timestamp,
              updatedAt: timestamp,
            };

            return {
              ...plan,
              updatedAt: timestamp,
              installments: [...plan.installments, installment],
            };
          }),
        }));
      },

      updateInstallment: (planId, installmentId, updates) => {
        const timestamp = nowIso();
        set((state) => ({
          plans: state.plans.map((plan) => {
            if (plan.id !== planId || plan.status !== "draft") return plan;

            return {
              ...plan,
              updatedAt: timestamp,
              installments: plan.installments.map((installment) => {
                if (installment.id !== installmentId) return installment;

                const updatedAmount =
                  typeof updates.amount === "number"
                    ? normalizeMoney(Math.max(0, updates.amount))
                    : installment.amount;

                return {
                  ...installment,
                  label: updates.label ?? installment.label,
                  dueDate: updates.dueDate ?? installment.dueDate,
                  amount: updatedAmount,
                  updatedAt: timestamp,
                };
              }),
            };
          }),
        }));
      },

      deleteInstallment: (planId, installmentId) => {
        const timestamp = nowIso();
        set((state) => ({
          plans: state.plans.map((plan) =>
            plan.id === planId && plan.status === "draft"
              ? {
                  ...plan,
                  updatedAt: timestamp,
                  installments: plan.installments.filter(
                    (item) => item.id !== installmentId
                  ),
                }
              : plan
          ),
        }));
      },

      activatePlan: (planId) => {
        const plan = get().plans.find((item) => item.id === planId);
        if (!plan) return { ok: false, error: "Payment plan not found." };
        if (plan.status !== "draft") {
          return { ok: false, error: "Only draft plans can be activated." };
        }
        if (plan.installments.length === 0) {
          return { ok: false, error: "Add at least one installment first." };
        }
        if (!isInstallmentsTotalValid(plan.installments, plan.totalAmount)) {
          return {
            ok: false,
            error: "Installment total must exactly match the agreed total.",
          };
        }

        const timestamp = nowIso();
        set((state) => ({
          plans: state.plans.map((item) =>
            item.id === planId
              ? {
                  ...item,
                  status: "active",
                  activatedAt: timestamp,
                  updatedAt: timestamp,
                }
              : item
          ),
        }));
        return { ok: true };
      },

      cancelPlan: (planId) => {
        const timestamp = nowIso();
        set((state) => ({
          plans: state.plans.map((plan) =>
            plan.id === planId
              ? {
                  ...plan,
                  status: "cancelled",
                  cancelledAt: timestamp,
                  updatedAt: timestamp,
                }
              : plan
          ),
        }));
      },

      payInstallment: (input) => {
        const state = get();
        const plan = state.plans.find(
          (item) => item.id === input.planId && item.caseId === input.caseId
        );
        if (!plan) return { ok: false, error: "Payment plan not found." };
        if (plan.status !== "active") {
          return { ok: false, error: "This plan is not open for payment." };
        }

        const installment = plan.installments.find(
          (item) => item.id === input.installmentId
        );
        if (!installment) return { ok: false, error: "Installment not found." };

        const remaining = getInstallmentRemainingAmount(installment);
        if (remaining <= 0) return { ok: false, error: "Installment is already paid." };
        if (input.amount <= 0) {
          return { ok: false, error: "Payment amount must be greater than zero." };
        }
        if (input.amount > remaining) {
          return { ok: false, error: "Amount exceeds installment remaining balance." };
        }

        const timestamp = nowIso();
        const normalizedAmount = normalizeMoney(input.amount);
        const provider: PaymentProvider =
          input.provider || (input.method === "stripe" ? "stripe" : "manual");
        const installmentPaidAmount = normalizeMoney(
          installment.paidAmount + normalizedAmount
        );
        const fullyPaid = installmentPaidAmount >= installment.amount;

        const receipt: Receipt = {
          id: createId("receipt"),
          receiptNo: createReceiptNo(state.receipts.length),
          caseId: input.caseId,
          planId: input.planId,
          installmentId: input.installmentId,
          amount: normalizedAmount,
          method: input.method,
          issuedAt: timestamp,
          provider,
          paymentIntentId: input.paymentIntentId,
          checkoutSessionId: input.checkoutSessionId,
        };

        const transaction: PaymentTransaction = {
          id: createId("txn"),
          caseId: input.caseId,
          planId: input.planId,
          installmentId: input.installmentId,
          amount: normalizedAmount,
          method: input.method,
          status: "success",
          createdAt: timestamp,
          provider,
          paymentIntentId: input.paymentIntentId,
          checkoutSessionId: input.checkoutSessionId,
        };

        set((current) => ({
          plans: current.plans.map((item) => {
            if (item.id !== input.planId) return item;

            const installments = item.installments.map((inst) =>
              inst.id === input.installmentId
                ? {
                    ...inst,
                    paidAmount: installmentPaidAmount,
                    paidAt: fullyPaid ? timestamp : inst.paidAt,
                    updatedAt: timestamp,
                  }
                : inst
            );

            const updatedPlan = {
              ...item,
              installments,
              updatedAt: timestamp,
            };
            const nextStatus = derivePlanStatus(updatedPlan);
            return {
              ...updatedPlan,
              status: nextStatus,
              completedAt:
                nextStatus === "completed"
                  ? updatedPlan.completedAt || timestamp
                  : updatedPlan.completedAt,
            };
          }),
          receipts: [receipt, ...current.receipts],
          transactions: [transaction, ...current.transactions],
        }));

        return { ok: true, receipt };
      },
    }),
    {
      name: "lawflow_payments_store",
    }
  )
);
