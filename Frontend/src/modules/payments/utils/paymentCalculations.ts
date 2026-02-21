import type {
  Installment,
  InstallmentStatus,
  PaymentPlan,
  PaymentPlanStatus,
} from "../types/payments";

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function startOfToday(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getInstallmentRemainingAmount(installment: Installment): number {
  return Math.max(0, installment.amount - installment.paidAmount);
}

export function getInstallmentsTotal(installments: Installment[]): number {
  return installments.reduce((sum, item) => sum + item.amount, 0);
}

export function isInstallmentsTotalValid(
  installments: Installment[],
  planTotal: number
): boolean {
  return Math.abs(getInstallmentsTotal(installments) - planTotal) < 0.01;
}

export function getInstallmentStatus(
  installment: Installment,
  today = new Date()
): InstallmentStatus {
  if (installment.paidAmount >= installment.amount) {
    return "paid";
  }

  const dueDate = parseDateOnly(installment.dueDate);
  if (dueDate < startOfToday(today)) {
    return "overdue";
  }

  if (installment.paidAmount > 0) {
    return "partially_paid";
  }

  return "pending";
}

export function getPlanTotals(plan: PaymentPlan): {
  total: number;
  paid: number;
  remaining: number;
} {
  const paid = plan.installments.reduce(
    (sum, item) => sum + Math.min(item.paidAmount, item.amount),
    0
  );
  return {
    total: plan.totalAmount,
    paid,
    remaining: Math.max(0, plan.totalAmount - paid),
  };
}

export function derivePlanStatus(
  plan: PaymentPlan,
  today = new Date()
): PaymentPlanStatus {
  if (plan.status === "cancelled") return "cancelled";

  const allPaid =
    plan.installments.length > 0 &&
    plan.installments.every((item) => getInstallmentStatus(item, today) === "paid");

  if (allPaid) return "completed";
  return plan.status;
}

export function getNextDueInstallment(
  plan: PaymentPlan,
  today = new Date()
): Installment | null {
  const openItems = plan.installments
    .filter((item) => getInstallmentStatus(item, today) !== "paid")
    .sort(
      (a, b) =>
        parseDateOnly(a.dueDate).getTime() - parseDateOnly(b.dueDate).getTime()
    );
  return openItems[0] || null;
}

export function formatCurrency(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString()}`;
}

