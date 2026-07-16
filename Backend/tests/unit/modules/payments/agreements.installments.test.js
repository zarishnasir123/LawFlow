import { describe, it, expect, afterEach, vi } from "vitest";
import { buildEqualMonthlyInstallments } from "../../../../src/modules/payments/agreements.service.js";

afterEach(() => vi.useRealTimers());

const sum = (rows) => rows.reduce((acc, r) => acc + r.amount, 0);

describe("buildEqualMonthlyInstallments", () => {
  it("splits an even total into equal whole-rupee parts", () => {
    const rows = buildEqualMonthlyInstallments(90_000, 3);
    expect(rows.map((r) => r.amount)).toEqual([30_000, 30_000, 30_000]);
  });

  it("lets the final installment absorb the remainder (10,000 / 3)", () => {
    const rows = buildEqualMonthlyInstallments(10_000, 3);
    expect(rows.map((r) => r.amount)).toEqual([3_333, 3_333, 3_334]);
  });

  it("always sums exactly to the total", () => {
    for (const [total, count] of [
      [10_000, 3],
      [99_999, 7],
      [1, 4],
      [250_000, 48],
    ]) {
      expect(sum(buildEqualMonthlyInstallments(total, count))).toBe(total);
    }
  });

  it("handles a single installment", () => {
    const rows = buildEqualMonthlyInstallments(45_500, 1);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(45_500);
  });

  it("clamps zero, negative, and non-numeric counts to one installment", () => {
    expect(buildEqualMonthlyInstallments(5_000, 0)).toHaveLength(1);
    expect(buildEqualMonthlyInstallments(5_000, -3)).toHaveLength(1);
    expect(buildEqualMonthlyInstallments(5_000, "abc")).toHaveLength(1);
    expect(buildEqualMonthlyInstallments(5_000, undefined)).toHaveLength(1);
  });

  it("keeps decimal totals exact (remainder carries the paisa)", () => {
    const rows = buildEqualMonthlyInstallments(100.75, 2);
    expect(rows[0].amount).toBe(50); // whole-rupee floor
    expect(rows[1].amount).toBe(50.75); // absorbs the fraction
    expect(sum(rows)).toBe(100.75);
  });

  it("produces one due date per installment in YYYY-MM-DD form, strictly increasing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15)); // Jan 15, local time
    const rows = buildEqualMonthlyInstallments(30_000, 3);
    const dates = rows.map((r) => r.dueDate);
    for (const d of dates) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const times = dates.map((d) => new Date(d).getTime());
    expect(times[0]).toBeLessThan(times[1]);
    expect(times[1]).toBeLessThan(times[2]);
    // Roughly one month apart (28–32 days).
    const dayGap = (a, b) => (b - a) / 86_400_000;
    expect(dayGap(times[0], times[1])).toBeGreaterThanOrEqual(28);
    expect(dayGap(times[0], times[1])).toBeLessThanOrEqual(32);
  });

  it("survives a month-end start date (Jan 31 rolls over instead of crashing)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 31)); // Jan 31, local time
    const rows = buildEqualMonthlyInstallments(20_000, 2);
    for (const r of rows) {
      expect(Number.isNaN(new Date(r.dueDate).getTime())).toBe(false);
    }
    expect(sum(rows)).toBe(20_000);
  });
});
