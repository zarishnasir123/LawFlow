import { describe, it, expect } from "vitest";
import {
  getInstallmentRemainingAmount,
  getInstallmentsTotal,
  isInstallmentsTotalValid,
  getInstallmentStatus,
  getPlanTotals,
  derivePlanStatus,
  getNextDueInstallment,
  formatCurrency,
} from "./paymentCalculations";
import type { Installment, PaymentPlan } from "../types/payments";

const inst = (over: Partial<Installment> = {}): Installment =>
  ({
    id: "i1",
    planId: "p1",
    label: "Installment 1",
    dueDate: "2026-08-01",
    amount: 10000,
    paidAmount: 0,
    createdAt: "",
    updatedAt: "",
    ...over,
  }) as Installment;

const plan = (over: Partial<PaymentPlan> = {}): PaymentPlan =>
  ({
    id: "p1",
    caseId: "c1",
    agreement: { caseId: "c1", agreedTotal: 30000, agreedAt: "" },
    totalAmount: 30000,
    status: "active",
    installments: [],
    createdAt: "",
    updatedAt: "",
    ...over,
  }) as PaymentPlan;

describe("getInstallmentRemainingAmount", () => {
  it("never goes negative", () => {
    expect(getInstallmentRemainingAmount(inst({ amount: 10000, paidAmount: 3000 }))).toBe(7000);
    expect(getInstallmentRemainingAmount(inst({ amount: 10000, paidAmount: 12000 }))).toBe(0);
  });
});

describe("getInstallmentsTotal / isInstallmentsTotalValid", () => {
  it("sums amounts and validates against the plan total within a rounding epsilon", () => {
    const rows = [inst({ amount: 10000 }), inst({ amount: 10000 }), inst({ amount: 10000 })];
    expect(getInstallmentsTotal(rows)).toBe(30000);
    expect(isInstallmentsTotalValid(rows, 30000)).toBe(true);
    expect(isInstallmentsTotalValid(rows, 30001)).toBe(false);
  });
});

describe("getInstallmentStatus", () => {
  const today = new Date("2026-08-15T12:00:00");

  it("is paid when fully covered", () => {
    expect(getInstallmentStatus(inst({ amount: 10000, paidAmount: 10000 }), today)).toBe("paid");
  });

  it("is overdue when unpaid and past due", () => {
    expect(getInstallmentStatus(inst({ dueDate: "2026-08-01", paidAmount: 0 }), today)).toBe(
      "overdue"
    );
  });

  it("is partially_paid when some paid and not yet overdue", () => {
    expect(
      getInstallmentStatus(inst({ dueDate: "2026-09-01", amount: 10000, paidAmount: 4000 }), today)
    ).toBe("partially_paid");
  });

  it("is pending when unpaid and not yet due", () => {
    expect(getInstallmentStatus(inst({ dueDate: "2026-09-01", paidAmount: 0 }), today)).toBe(
      "pending"
    );
  });
});

describe("getPlanTotals", () => {
  it("caps each paid amount at its installment amount", () => {
    const p = plan({
      totalAmount: 20000,
      installments: [
        inst({ amount: 10000, paidAmount: 15000 }), // overpay clamped
        inst({ amount: 10000, paidAmount: 4000 }),
      ],
    });
    expect(getPlanTotals(p)).toEqual({ total: 20000, paid: 14000, remaining: 6000 });
  });
});

describe("derivePlanStatus", () => {
  const today = new Date("2026-08-15T12:00:00");

  it("stays cancelled regardless of payments", () => {
    expect(derivePlanStatus(plan({ status: "cancelled" }), today)).toBe("cancelled");
  });

  it("becomes completed when every installment is paid", () => {
    const p = plan({
      status: "active",
      installments: [inst({ amount: 100, paidAmount: 100 }), inst({ amount: 100, paidAmount: 100 })],
    });
    expect(derivePlanStatus(p, today)).toBe("completed");
  });

  it("keeps the stored status when not all paid", () => {
    const p = plan({ status: "active", installments: [inst({ paidAmount: 0 })] });
    expect(derivePlanStatus(p, today)).toBe("active");
  });
});

describe("getNextDueInstallment", () => {
  it("returns the earliest unpaid installment", () => {
    const p = plan({
      installments: [
        inst({ id: "b", dueDate: "2026-09-01", paidAmount: 0 }),
        inst({ id: "a", dueDate: "2026-08-01", paidAmount: 0 }),
        inst({ id: "paid", dueDate: "2026-07-01", amount: 100, paidAmount: 100 }),
      ],
    });
    expect(getNextDueInstallment(p, new Date("2026-07-15"))?.id).toBe("a");
  });

  it("returns null when everything is paid", () => {
    const p = plan({ installments: [inst({ amount: 100, paidAmount: 100 })] });
    expect(getNextDueInstallment(p)).toBeNull();
  });
});

describe("formatCurrency", () => {
  it("prefixes Rs. and groups thousands", () => {
    expect(formatCurrency(1234567)).toBe("Rs. 1,234,567");
    expect(formatCurrency(999.6)).toBe("Rs. 1,000");
  });
});
