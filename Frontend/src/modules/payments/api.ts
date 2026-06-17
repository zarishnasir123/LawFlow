import { apiClient } from "../../shared/api/axios";

export type AgreementInstallmentInput = {
  amount: number;
  dueDate: string;
};

export type AgreementSnapshotData = {
  agreement: {
    id: string;
    caseId: string;
    lawyerUserId: string;
    clientUserId: string;
    lawyerBaseFee: number;
    agreedTotalAmount: number;
    currency: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  caseTitle: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  caseCategory?: string;
  caseTypeName?: string;
  lawyerName: string;
  installments: Array<{
    id: string;
    installmentNumber: number;
    amount: number;
    dueDate: string | null;
    status: "pending" | "paid" | "overdue" | "cancelled";
    paidAt?: string | null;
  }>;
  totalAmountPaid: number;
  remainingBalance: number;
  paymentPlan?: {
    id: string;
    totalAmount: number;
    frequency: string;
    installmentCount: number;
  } | null;
};

export type LawyerAgreementCase = {
  id: string;
  title: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientUserId: string | null;
  caseCategory: string;
  caseTypeName: string;
  status: string;
  hasAgreement: boolean;
  agreementId?: string | null;
};

export const createAgreement = async (agreementData: {
  caseId: string;
  clientUserId: string;
  agreedTotalAmount: number;
  frequency?: string;
  installmentCount?: number;
  installments?: AgreementInstallmentInput[];
}) => {
  const { data } = await apiClient.post("/payments/agreements", agreementData);
  return data.data as AgreementSnapshotData;
};

export const getAgreement = async (agreementId: string) => {
  const { data } = await apiClient.get(`/payments/agreements/${agreementId}`);
  return data.data as AgreementSnapshotData;
};

export const getAgreementsByCase = async (caseId: string) => {
  const { data } = await apiClient.get(`/payments/case/${caseId}/agreements`);
  return data.data as AgreementSnapshotData[];
};

export const getLawyerAgreementCases = async () => {
  const { data } = await apiClient.get("/payments/lawyer/agreement-cases");
  return data.data as LawyerAgreementCase[];
};

export type LawyerCasePaymentContext = {
  case: {
    id: string;
    title: string;
    clientName: string;
    clientEmail?: string | null;
    clientPhone?: string | null;
    clientUserId: string | null;
    caseCategory: string;
    caseTypeName: string;
  };
  caseCategory: string;
  categoryFee: number;
  hasCategoryFee: boolean;
  familyCaseFee: number | null;
  civilCaseFee: number | null;
  hasPaymentPlan: boolean;
};

export const getLawyerCasePaymentContext = async (caseId: string) => {
  const { data } = await apiClient.get(
    `/payments/lawyer/cases/${caseId}/agreement-context`
  );
  return data.data as LawyerCasePaymentContext;
};

/** @deprecated Use getLawyerCasePaymentContext */
export const getLawyerCaseAgreementContext = getLawyerCasePaymentContext;

export const createPaymentPlan = async (
  caseId: string,
  payload: {
    totalAmount: number;
    installmentCount: number;
    // Optional lawyer-customized due dates (one per installment, YYYY-MM-DD).
    // Amounts stay system-computed; only the dates are honoured.
    installments?: { dueDate: string }[];
  }
) => {
  const { data } = await apiClient.post(
    `/payments/lawyer/cases/${caseId}/payment-plan`,
    payload
  );
  return data.data as AgreementSnapshotData;
};

export type PublicCaseCharges = {
  charges: Array<{ category: string; amount: number }>;
} | null;

export const getLawyerPublicCaseCharges = async (lawyerProfileId: string) => {
  const { data } = await apiClient.get(
    `/payments/${lawyerProfileId}/service-charges`
  );
  return data.data as PublicCaseCharges;
};

export const getClientAgreements = async () => {
  const { data } = await apiClient.get("/payments/client/agreements");
  return data.data as AgreementSnapshotData[];
};

export type ServiceChargesData = {
  familyCaseFee: number | null;
  civilCaseFee: number | null;
};

export const getServiceCharges = async (): Promise<ServiceChargesData | null> => {
  const { data } = await apiClient.get("/payments/service-charges");
  const row = data.data as {
    familyCaseFee?: number | string | null;
    civilCaseFee?: number | string | null;
    baseFee?: number | string;
  } | null;
  if (!row) return null;
  const family =
    row.familyCaseFee != null ? Number(row.familyCaseFee) : Number(row.baseFee) || null;
  const civil =
    row.civilCaseFee != null ? Number(row.civilCaseFee) : Number(row.baseFee) || null;
  return {
    familyCaseFee: family && family > 0 ? family : null,
    civilCaseFee: civil && civil > 0 ? civil : null,
  };
};

export const updateServiceCharges = async (payload: {
  familyCaseFee?: number;
  civilCaseFee?: number;
}) => {
  const { data } = await apiClient.put("/payments/service-charges", payload);
  return data.data;
};

export const createCheckoutSession = async (installmentData: {
  installmentId: string;
  amount: number;
  caseName: string;
  currency?: string;
}) => {
  const { data } = await apiClient.post(
    "/payments/create-checkout-session",
    installmentData
  );
  return data.data as { sessionId: string; sessionUrl: string };
};

// Called after Safepay redirects the browser back to the app. Safepay's hosted
// checkout appends `order_id` (our installment id) to the return URL; the
// backend looks up that installment's tracker and asks Safepay (server-to-
// server) whether it was actually paid, then records it. A `tracker` may be
// passed instead for the older signed-redirect flow.
export const confirmPayment = async (payload: {
  orderId?: string;
  tracker?: string;
  reference?: string | null;
}) => {
  const { data } = await apiClient.post("/payments/confirm", payload);
  return data as {
    recorded: boolean;
    duplicate: boolean;
    pending?: boolean;
  };
};

export const getPaymentTransactions = async (caseId?: string) => {
  const { data } = await apiClient.get("/payments/transactions", {
    params: caseId ? { caseId } : undefined,
  });
  return data.data;
};

export const getPaymentReceipts = async (caseId?: string) => {
  const { data } = await apiClient.get("/payments/receipts", {
    params: caseId ? { caseId } : undefined,
  });
  return data.data;
};

export const getPaymentReceipt = async (receiptId: string) => {
  const { data } = await apiClient.get(`/payments/receipts/${receiptId}`);
  return data.data;
};

export type LawyerEarningsBalance = {
  // Total clients have paid against this lawyer's cases.
  grossEarned: number;
  // The platform's commission, summed from the per-transaction snapshots.
  platformFee: number;
  // The lawyer's share after the platform fee (gross − platform fee).
  netEarned: number;
  // Net already settled to the lawyer's bank (status = 'paid' payouts).
  paidOut: number;
  // Net tied up in payouts that are requested/processing (not yet paid).
  pendingPayouts: number;
  // What the lawyer can still withdraw (net − paidOut − pendingPayouts).
  available: number;
  // Current platform commission rate, for the "platform fee (X%)" label only.
  commissionRate: number;
};

export type LawyerEarnings = {
  totalReceived: number;
  paymentsCount: number;
  balance: LawyerEarningsBalance;
  byCase: Array<{
    caseId: string;
    caseTitle: string;
    clientName: string;
    totalReceived: number;
    paymentsCount: number;
    lastPaymentAt: string;
  }>;
  recent: Array<{
    id: string;
    installmentId: string;
    amount: number;
    status: string;
    createdAt: string;
    caseTitle?: string;
    clientName?: string;
    installmentNumber?: number;
  }>;
};

// Lawyer "Payments Received" view — the money clients have actually paid this
// lawyer, with a per-case breakdown and overall total.
export const getLawyerEarnings = async (): Promise<LawyerEarnings> => {
  const { data } = await apiClient.get("/payments/lawyer/earnings");
  return data.data as LawyerEarnings;
};

export type LawyerPayoutAccount = {
  accountTitle: string | null;
  accountNumber: string | null;
  bankName: string | null;
} | null;

// Where LawFlow settles the lawyer's collected payments (his bank account).
export const getLawyerPayoutAccount = async (): Promise<LawyerPayoutAccount> => {
  const { data } = await apiClient.get("/payments/lawyer/payout-account");
  return data.data as LawyerPayoutAccount;
};

export const updateLawyerPayoutAccount = async (payload: {
  accountTitle?: string;
  accountNumber?: string;
  bankName?: string;
}): Promise<LawyerPayoutAccount> => {
  const { data } = await apiClient.put("/payments/lawyer/payout-account", payload);
  return data.data as LawyerPayoutAccount;
};

export type PayoutStatus =
  | "requested"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled";

// One payout record (the platform settling a lawyer's earnings to their bank).
// Bank fields are the snapshot taken when the payout was requested.
export type LawyerPayout = {
  id: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  accountTitle: string | null;
  accountNumber: string | null;
  bankName: string | null;
  reference: string | null;
  note: string | null;
  requestedAt: string;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// Lawyer asks LawFlow to pay out their full available balance. The backend
// creates a 'requested' payout; the admin later marks it paid.
export const requestLawyerPayout = async (): Promise<LawyerPayout> => {
  const { data } = await apiClient.post("/payments/lawyer/request-payout");
  return data.data as LawyerPayout;
};

export const getLawyerPayouts = async (): Promise<LawyerPayout[]> => {
  const { data } = await apiClient.get("/payments/lawyer/payouts");
  return data.data as LawyerPayout[];
};
