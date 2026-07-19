import { describe, it, expect } from "vitest";
import { mapApiInstallments } from "./mapInstallments";
import type { AgreementSnapshotData } from "../api";

const snapshot = (rows: unknown[]): AgreementSnapshotData =>
  ({
    agreement: { id: "plan-1" },
    installments: rows,
  }) as unknown as AgreementSnapshotData;

describe("mapApiInstallments", () => {
  it('labels installment 0 as "Service Charge" and the rest by number', () => {
    const out = mapApiInstallments(
      snapshot([
        { id: "a", installmentNumber: 0, dueDate: "2026-08-01", amount: 5000, status: "pending" },
        { id: "b", installmentNumber: 1, dueDate: "2026-09-01", amount: 10000, status: "pending" },
      ])
    );
    expect(out[0].label).toBe("Service Charge");
    expect(out[1].label).toBe("Installment 1");
    expect(out.every((r) => r.planId === "plan-1")).toBe(true);
  });

  it("marks paidAmount = amount only for paid rows", () => {
    const out = mapApiInstallments(
      snapshot([
        { id: "a", installmentNumber: 1, dueDate: "2026-08-01", amount: 10000, status: "paid", paidAt: "2026-08-02" },
        { id: "b", installmentNumber: 2, dueDate: "2026-09-01", amount: 10000, status: "pending" },
      ])
    );
    expect(out[0].paidAmount).toBe(10000);
    expect(out[0].paidAt).toBe("2026-08-02");
    expect(out[1].paidAmount).toBe(0);
  });

  it("drops rows with a negative installment number", () => {
    const out = mapApiInstallments(
      snapshot([{ id: "x", installmentNumber: -1, dueDate: "2026-08-01", amount: 100, status: "pending" }])
    );
    expect(out).toHaveLength(0);
  });

  it("supplies today's date when a row has no due date", () => {
    const out = mapApiInstallments(
      snapshot([{ id: "a", installmentNumber: 1, dueDate: "", amount: 100, status: "pending" }])
    );
    expect(out[0].dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
