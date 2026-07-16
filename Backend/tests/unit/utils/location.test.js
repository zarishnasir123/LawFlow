import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getSupportedTehsils,
  isSupportedTehsil,
  deriveLocationFromAddress,
} from "../../../src/utils/location.js";

afterEach(() => vi.unstubAllEnvs());

describe("getSupportedTehsils", () => {
  it("defaults to the Gujranwala jurisdictions, lowercased", () => {
    vi.stubEnv("SUPPORTED_TEHSILS", undefined);
    expect(getSupportedTehsils()).toEqual([
      "gujranwala",
      "gujranwala city & sadar",
      "kamoke",
      "nowshera virkan",
      "wazirabad",
    ]);
  });

  it("falls back to the defaults when the env var is an empty string", () => {
    vi.stubEnv("SUPPORTED_TEHSILS", "");
    expect(getSupportedTehsils()).toHaveLength(5);
  });

  it("uses the env override, trimming and lowercasing entries", () => {
    vi.stubEnv("SUPPORTED_TEHSILS", " Lahore , Model Town ");
    expect(getSupportedTehsils()).toEqual(["lahore", "model town"]);
  });

  it("drops blank entries left by stray commas", () => {
    vi.stubEnv("SUPPORTED_TEHSILS", "Lahore,,Kasur,");
    expect(getSupportedTehsils()).toEqual(["lahore", "kasur"]);
  });
});

describe("isSupportedTehsil", () => {
  it("treats empty / null / undefined as supported (permissive gate)", () => {
    expect(isSupportedTehsil("")).toBe(true);
    expect(isSupportedTehsil(null)).toBe(true);
    expect(isSupportedTehsil(undefined)).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(isSupportedTehsil("KAMOKE")).toBe(true);
    expect(isSupportedTehsil("Wazirabad")).toBe(true);
  });

  it("matches after trimming whitespace", () => {
    expect(isSupportedTehsil("  Kamoke  ")).toBe(true);
  });

  it("rejects a tehsil outside the supported list", () => {
    expect(isSupportedTehsil("Lahore")).toBe(false);
  });
});

describe("deriveLocationFromAddress", () => {
  it("returns nulls for empty, whitespace-only, and non-string input", () => {
    expect(deriveLocationFromAddress("")).toEqual({ city: null, tehsil: null });
    expect(deriveLocationFromAddress("   ")).toEqual({ city: null, tehsil: null });
    expect(deriveLocationFromAddress(null)).toEqual({ city: null, tehsil: null });
    expect(deriveLocationFromAddress(12345)).toEqual({ city: null, tehsil: null });
  });

  it("takes the last comma-separated segment as the city", () => {
    const result = deriveLocationFromAddress("House 5, Street 2, Gujranwala");
    expect(result.city).toBe("Gujranwala");
  });

  it("ignores a trailing comma when picking the city", () => {
    const result = deriveLocationFromAddress("House 5, Street 2, Gujranwala,");
    expect(result.city).toBe("Gujranwala");
  });

  it("uses the whole string as city when there are no commas", () => {
    const result = deriveLocationFromAddress("Wazirabad");
    expect(result.city).toBe("Wazirabad");
  });

  it("finds a tehsil mentioned in the middle of the address", () => {
    const result = deriveLocationFromAddress("House 5, Kamoke Road, Punjab");
    expect(result.tehsil).toBe("Kamoke");
    expect(result.city).toBe("Punjab");
  });

  it("does not match a tehsil hiding inside a longer word", () => {
    // "Wazirabadi" contains "wazirabad" but is a different word.
    const result = deriveLocationFromAddress("Wazirabadi Chowk, Lahore");
    expect(result.tehsil).toBeNull();
  });

  it("prefers the earliest entry in the supported list when several match", () => {
    // Address mentions both Kamoke and Gujranwala; "gujranwala" comes first
    // in the supported list, so it wins.
    const result = deriveLocationFromAddress("House 5, Kamoke, Gujranwala");
    expect(result.tehsil).toBe("Gujranwala");
  });

  it("title-cases only the first letter of the stored tehsil", () => {
    const result = deriveLocationFromAddress("Main Bazaar, nowshera virkan, Punjab");
    expect(result.tehsil).toBe("Nowshera virkan");
  });

  it("safely matches tehsil names containing regex characters like &", () => {
    vi.stubEnv("SUPPORTED_TEHSILS", "Gujranwala City & Sadar");
    const result = deriveLocationFromAddress("Court Road, Gujranwala City & Sadar");
    expect(result.tehsil).toBe("Gujranwala city & sadar");
  });

  it("returns a city but null tehsil when nothing in the list matches", () => {
    const result = deriveLocationFromAddress("House 1, Gulberg, Lahore");
    expect(result).toEqual({ city: "Lahore", tehsil: null });
  });
});
