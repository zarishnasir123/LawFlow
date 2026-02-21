import type {
  Agreement,
  Installment,
  PaymentPlan,
  PaymentTransaction,
  Receipt,
} from "../types/payments";

const now = "2026-02-20T10:30:00.000Z";

export const paymentAgreementsMock: Agreement[] = [
  {
    caseId: "1",
    lawyerBaseFee: 100000,
    agreedTotal: 120000,
    agreedAt: "2026-01-15T09:30:00.000Z",
    notes:
      "Final amount agreed in chat after additional affidavit and annexure drafting.",
  },
  {
    caseId: "2",
    lawyerBaseFee: 80000,
    agreedTotal: 90000,
    agreedAt: "2026-02-01T11:00:00.000Z",
    notes: "Includes hearing preparation and notice drafting.",
  },
];

const planOneInstallments: Installment[] = [
  {
    id: "inst-1",
    planId: "plan-1",
    label: "Retainer",
    dueDate: "2026-01-20",
    amount: 30000,
    paidAmount: 30000,
    paidAt: "2026-01-19T13:22:00.000Z",
    createdAt: "2026-01-15T09:32:00.000Z",
    updatedAt: "2026-01-19T13:22:00.000Z",
  },
  {
    id: "inst-2",
    planId: "plan-1",
    label: "Evidence Collection",
    dueDate: "2026-03-05",
    amount: 30000,
    paidAmount: 10000,
    createdAt: "2026-01-15T09:32:00.000Z",
    updatedAt: "2026-02-10T10:00:00.000Z",
  },
  {
    id: "inst-3",
    planId: "plan-1",
    label: "Pleadings Submission",
    dueDate: "2026-02-10",
    amount: 30000,
    paidAmount: 0,
    createdAt: "2026-01-15T09:32:00.000Z",
    updatedAt: "2026-01-15T09:32:00.000Z",
  },
  {
    id: "inst-4",
    planId: "plan-1",
    label: "Final Hearing",
    dueDate: "2026-04-01",
    amount: 30000,
    paidAmount: 0,
    createdAt: "2026-01-15T09:32:00.000Z",
    updatedAt: "2026-01-15T09:32:00.000Z",
  },
];

export const paymentPlansMock: PaymentPlan[] = [
  {
    id: "plan-1",
    caseId: "1",
    agreement: paymentAgreementsMock[0],
    totalAmount: 120000,
    status: "active",
    installments: planOneInstallments,
    createdAt: "2026-01-15T09:32:00.000Z",
    updatedAt: now,
    activatedAt: "2026-01-16T10:00:00.000Z",
  },
];

export const paymentReceiptsMock: Receipt[] = [
  {
    id: "receipt-1",
    receiptNo: "RCPT-2026-00001",
    caseId: "1",
    planId: "plan-1",
    installmentId: "inst-1",
    amount: 30000,
    method: "bank_transfer",
    issuedAt: "2026-01-19T13:22:00.000Z",
    provider: "manual",
  },
  {
    id: "receipt-2",
    receiptNo: "RCPT-2026-00002",
    caseId: "1",
    planId: "plan-1",
    installmentId: "inst-2",
    amount: 10000,
    method: "card",
    issuedAt: "2026-02-10T10:00:00.000Z",
    provider: "manual",
  },
];

export const paymentTransactionsMock: PaymentTransaction[] = [
  {
    id: "txn-1",
    caseId: "1",
    planId: "plan-1",
    installmentId: "inst-1",
    amount: 30000,
    method: "bank_transfer",
    status: "success",
    createdAt: "2026-01-19T13:22:00.000Z",
    provider: "manual",
  },
  {
    id: "txn-2",
    caseId: "1",
    planId: "plan-1",
    installmentId: "inst-2",
    amount: 10000,
    method: "card",
    status: "success",
    createdAt: "2026-02-10T10:00:00.000Z",
    provider: "manual",
  },
];
