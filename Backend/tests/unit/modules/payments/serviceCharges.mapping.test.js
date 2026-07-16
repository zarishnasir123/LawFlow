import { describe, it, expect } from "vitest";
import {
  mapServiceChargesRow,
  getCategoryFeeFromRow,
} from "../../../../src/modules/payments/serviceCharges.service.js";

const row = (overrides = {}) => ({
  id: "sc-1",
  lawyer_profile_id: "lp-1",
  base_fee: "0",
  family_case_fee: null,
  civil_case_fee: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("mapServiceChargesRow", () => {
  it("returns null for a missing row", () => {
    expect(mapServiceChargesRow(null)).toBeNull();
    expect(mapServiceChargesRow(undefined)).toBeNull();
  });

  it("parses numeric strings from the database into numbers", () => {
    const mapped = mapServiceChargesRow(
      row({ base_fee: "5000", family_case_fee: "7500.50", civil_case_fee: "6000" })
    );
    expect(mapped.baseFee).toBe(5000);
    expect(mapped.familyCaseFee).toBe(7500.5);
    expect(mapped.civilCaseFee).toBe(6000);
  });

  it("falls back to the legacy base fee when a category fee is missing", () => {
    const mapped = mapServiceChargesRow(row({ base_fee: "4000" }));
    expect(mapped.familyCaseFee).toBe(4000);
    expect(mapped.civilCaseFee).toBe(4000);
  });

  it("returns null category fees when nothing is set (base fee zero)", () => {
    const mapped = mapServiceChargesRow(row());
    expect(mapped.familyCaseFee).toBeNull();
    expect(mapped.civilCaseFee).toBeNull();
  });

  it("ignores zero and negative category fees (treated as unset)", () => {
    const mapped = mapServiceChargesRow(
      row({ family_case_fee: "0", civil_case_fee: "-100" })
    );
    expect(mapped.familyCaseFee).toBeNull();
    expect(mapped.civilCaseFee).toBeNull();
  });

  it("maps snake_case columns to the camelCase API shape", () => {
    const mapped = mapServiceChargesRow(row({ family_case_fee: "1000" }));
    expect(mapped).toMatchObject({
      id: "sc-1",
      lawyerProfileId: "lp-1",
      familyCaseFee: 1000,
    });
  });
});

describe("getCategoryFeeFromRow", () => {
  const charged = row({ family_case_fee: "7000", civil_case_fee: "9000" });

  it("returns the family fee for family cases", () => {
    expect(getCategoryFeeFromRow(charged, "family")).toBe(7000);
  });

  it("returns the civil fee for civil cases", () => {
    expect(getCategoryFeeFromRow(charged, "civil")).toBe(9000);
  });

  it("is case-insensitive about the category", () => {
    expect(getCategoryFeeFromRow(charged, "FAMILY")).toBe(7000);
    expect(getCategoryFeeFromRow(charged, "Civil")).toBe(9000);
  });

  it("returns 0 for an unknown category or missing row", () => {
    expect(getCategoryFeeFromRow(charged, "criminal")).toBe(0);
    expect(getCategoryFeeFromRow(charged, null)).toBe(0);
    expect(getCategoryFeeFromRow(null, "family")).toBe(0);
  });

  it("returns 0 when the category fee is unset", () => {
    expect(getCategoryFeeFromRow(row(), "family")).toBe(0);
  });
});
