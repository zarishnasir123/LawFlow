import type { AgreementSnapshotData } from "../api";
import type { Installment } from "../types/payments";

export function mapApiInstallments(
  snapshot: AgreementSnapshotData
): Installment[] {
  const planId = snapshot.agreement.id;
  const now = new Date().toISOString();

  return snapshot.installments
    .filter((row) => row.installmentNumber >= 0)
    .map((row) => ({
      id: row.id,
      planId,
      label:
        row.installmentNumber === 0
          ? "Service Charge"
          : `Installment ${row.installmentNumber}`,
      dueDate: row.dueDate || new Date().toISOString().slice(0, 10),
      amount: row.amount,
      paidAmount: row.status === "paid" ? row.amount : 0,
      paidAt: row.paidAt || undefined,
      createdAt: now,
      updatedAt: now,
    }));
}
