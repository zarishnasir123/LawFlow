import { describe, it, expect } from "vitest";
import { isValidUuid } from "../../../src/utils/uuid.js";

const VALID_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("isValidUuid", () => {
  it("accepts a valid lowercase UUID", () => {
    expect(isValidUuid(VALID_UUID)).toBe(true);
  });

  it("accepts an uppercase UUID (case-insensitive)", () => {
    expect(isValidUuid(VALID_UUID.toUpperCase())).toBe(true);
  });

  it("accepts a UUID with surrounding whitespace", () => {
    expect(isValidUuid(`  ${VALID_UUID}  `)).toBe(true);
  });

  it("rejects a wrong version digit (only versions 1-5 allowed)", () => {
    // 14th hex digit is the version — 9 is not a real UUID version.
    expect(isValidUuid("3f2504e0-4f89-91d3-9a0c-0305e82c3301")).toBe(false);
  });

  it("rejects an invalid variant digit (must be 8, 9, a, or b)", () => {
    // 17th hex digit is the variant — "c" is outside the RFC range.
    expect(isValidUuid("3f2504e0-4f89-41d3-ca0c-0305e82c3301")).toBe(false);
  });

  it("rejects missing or misplaced dashes", () => {
    expect(isValidUuid("3f2504e04f8941d39a0c0305e82c3301")).toBe(false);
    expect(isValidUuid("3f2504e0-4f8941d3-9a0c-0305e-82c3301")).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isValidUuid("3f2504g0-4f89-41d3-9a0c-0305e82c3301")).toBe(false);
  });

  it('rejects the literal string "1" and empty input', () => {
    expect(isValidUuid("1")).toBe(false);
    expect(isValidUuid("")).toBe(false);
    expect(isValidUuid("   ")).toBe(false);
  });

  it("rejects null, undefined, and non-string values", () => {
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(undefined)).toBe(false);
    expect(isValidUuid(12345)).toBe(false);
    expect(isValidUuid({})).toBe(false);
  });
});
