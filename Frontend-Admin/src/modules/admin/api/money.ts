import { apiClient } from "../../../shared/api/axios";

export type MoneyTotals = {
  collected: number;
  platformFees: number;
  netToLawyers: number;
  paidOut: number;
  inProgressPayouts: number;
  owed: number;
  paymentsCount: number;
  paidPayoutsCount: number;
  openPayoutsCount: number;
};

export type MoneyReconciliation = {
  collected: number;
  platformFees: number;
  paidOut: number;
  owed: number;
  balances: boolean;
};

export type LawyerMoneyRow = {
  lawyerUserId: string;
  lawyerName: string;
  lawyerEmail: string | null;
  grossEarned: number;
  platformFee: number;
  netEarned: number;
  paidOut: number;
  inProgressPayouts: number;
  owed: number;
};

export type MoneyOverview = {
  totals: MoneyTotals;
  reconciliation: MoneyReconciliation;
  perLawyer: LawyerMoneyRow[];
};

export async function fetchMoneyOverview(): Promise<MoneyOverview> {
  const { data } = await apiClient.get<MoneyOverview>("/admin/money-overview");
  return data;
}

export type CommissionRate = {
  commissionRate: number;
  updatedAt: string | null;
};

export async function fetchCommissionRate(): Promise<CommissionRate> {
  const { data } = await apiClient.get<CommissionRate>("/admin/commission-rate");
  return data;
}

export async function updateCommissionRate(
  commissionRate: number
): Promise<CommissionRate> {
  const { data } = await apiClient.put<{ commissionRate: number; updatedAt: string | null }>(
    "/admin/commission-rate",
    { commissionRate }
  );
  return { commissionRate: data.commissionRate, updatedAt: data.updatedAt };
}
