export type PaymentPlanStatus = "draft" | "active" | "completed" | "cancelled";

export type InstallmentStatus =
  | "pending"
  | "partially_paid"
  | "paid"
  | "overdue";

export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "card"
  | "easypaisa"
  | "jazzcash"
  | "stripe";

export type PaymentProvider = "manual" | "stripe";

export interface Agreement {
  caseId: string;
  agreedTotal: number;
  agreedAt: string;
  notes?: string;
  lawyerBaseFee?: number;
}

export interface Installment {
  id: string;
  planId: string;
  label: string;
  dueDate: string; // YYYY-MM-DD
  amount: number;
  paidAmount: number;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentPlan {
  id: string;
  caseId: string;
  agreement: Agreement;
  totalAmount: number;
  status: PaymentPlanStatus;
  installments: Installment[];
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

export interface Receipt {
  id: string;
  receiptNo: string;
  caseId: string;
  planId: string;
  installmentId: string;
  amount: number;
  method: PaymentMethod;
  issuedAt: string;
  provider?: PaymentProvider;
  paymentIntentId?: string;
  checkoutSessionId?: string;
}

export interface PaymentTransaction {
  id: string;
  caseId: string;
  planId: string;
  installmentId: string;
  amount: number;
  method: PaymentMethod;
  status: "success" | "failed";
  createdAt: string;
  provider?: PaymentProvider;
  paymentIntentId?: string;
  checkoutSessionId?: string;
}
