import { describe, it, expect, afterEach, vi } from "vitest";
import {
  normalizeCnic,
  isValidPakistanCnic,
  getAllowedCnicPrefixes,
  isAllowedDistrictCnic,
} from "../../../src/utils/cnic.js";

describe("normalizeCnic", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeCnic("  34101-1234567-1  ")).toBe("34101-1234567-1");
  });

  it("turns null and undefined into an empty string", () => {
    expect(normalizeCnic(null)).toBe("");
    expect(normalizeCnic(undefined)).toBe("");
  });

  it("stringifies non-string input", () => {
    expect(normalizeCnic(12345)).toBe("12345");
  });
});

describe("isValidPakistanCnic", () => {
  it("accepts a correctly formatted CNIC (#####-#######-#)", () => {
    expect(isValidPakistanCnic("34101-1234567-1")).toBe(true);
  });

  it("accepts a valid CNIC with surrounding whitespace", () => {
    expect(isValidPakistanCnic(" 34101-1234567-1 ")).toBe(true);
  });

  it("rejects a CNIC without dashes", () => {
    expect(isValidPakistanCnic("3410112345671")).toBe(false);
  });

  it("rejects misplaced dashes", () => {
    expect(isValidPakistanCnic("341011-234567-1")).toBe(false);
  });

  it("rejects 12 digits (one short)", () => {
    expect(isValidPakistanCnic("34101-123456-1")).toBe(false);
  });

  it("rejects 14 digits (one extra)", () => {
    expect(isValidPakistanCnic("34101-12345678-1")).toBe(false);
  });

  it("rejects letters inside the CNIC", () => {
    expect(isValidPakistanCnic("3410a-1234567-1")).toBe(false);
  });

  it("rejects the obvious fake where all 13 digits are identical", () => {
    expect(isValidPakistanCnic("11111-1111111-1")).toBe(false);
    expect(isValidPakistanCnic("99999-9999999-9")).toBe(false);
  });

  it("accepts repeated-but-not-identical digits", () => {
    expect(isValidPakistanCnic("11111-1111111-2")).toBe(true);
  });

  it("rejects empty, null, undefined, and numeric input", () => {
    expect(isValidPakistanCnic("")).toBe(false);
    expect(isValidPakistanCnic(null)).toBe(false);
    expect(isValidPakistanCnic(undefined)).toBe(false);
    expect(isValidPakistanCnic(3410112345671)).toBe(false);
  });
});

describe("getAllowedCnicPrefixes", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to the six Gujranwala locality codes when the env var is unset", () => {
    vi.stubEnv("ALLOWED_CNIC_PREFIXES", undefined);
    expect(getAllowedCnicPrefixes()).toEqual([
      "34101",
      "34102",
      "34103",
      "34104",
      "34105",
      "34106",
    ]);
  });

  it("falls back to the defaults when the env var is an empty string", () => {
    vi.stubEnv("ALLOWED_CNIC_PREFIXES", "");
    expect(getAllowedCnicPrefixes()).toHaveLength(6);
  });

  it("uses the env var override and trims spaces around entries", () => {
    vi.stubEnv("ALLOWED_CNIC_PREFIXES", " 35201 , 35202 ");
    expect(getAllowedCnicPrefixes()).toEqual(["35201", "35202"]);
  });

  it("drops blank entries left by stray commas", () => {
    vi.stubEnv("ALLOWED_CNIC_PREFIXES", "35201,,35202,");
    expect(getAllowedCnicPrefixes()).toEqual(["35201", "35202"]);
  });
});

describe("isAllowedDistrictCnic", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts a Gujranwala-district CNIC under the default prefixes", () => {
    expect(isAllowedDistrictCnic("34104-1234567-1")).toBe(true);
  });

  it("rejects a CNIC from another district under the default prefixes", () => {
    expect(isAllowedDistrictCnic("35202-1234567-1")).toBe(false);
  });

  it("respects an env override of the allowed prefixes", () => {
    vi.stubEnv("ALLOWED_CNIC_PREFIXES", "35202");
    expect(isAllowedDistrictCnic("35202-1234567-1")).toBe(true);
    expect(isAllowedDistrictCnic("34101-1234567-1")).toBe(false);
  });

  it("allows everything when the prefix list is effectively empty (only commas)", () => {
    vi.stubEnv("ALLOWED_CNIC_PREFIXES", ",");
    expect(isAllowedDistrictCnic("99999-1234567-1")).toBe(true);
  });

  it("matches against the trimmed CNIC", () => {
    expect(isAllowedDistrictCnic("  34101-1234567-1")).toBe(true);
  });
});
1