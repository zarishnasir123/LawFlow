import { describe, it, expect } from "vitest";
import {
  CNIC_PATTERN,
  formatCnic,
  stripDashes,
  parseOcrResponse,
} from "../../../../src/modules/auth/cnicOcr.parse.js";

describe("formatCnic", () => {
  it("formats a 13-digit string with dashes", () => {
    expect(formatCnic("3410197218759")).toBe("34101-9721875-9");
  });

  it("returns non-13-digit input unchanged", () => {
    expect(formatCnic("123456789012")).toBe("123456789012");
    expect(formatCnic("12345678901234")).toBe("12345678901234");
    expect(formatCnic("")).toBe("");
  });
});

describe("stripDashes", () => {
  it("removes every dash", () => {
    expect(stripDashes("34101-9721875-9")).toBe("3410197218759");
  });

  it("stringifies and handles null/undefined", () => {
    expect(stripDashes(null)).toBe("");
    expect(stripDashes(undefined)).toBe("");
    expect(stripDashes(12345)).toBe("12345");
  });
});

describe("CNIC_PATTERN", () => {
  it("matches dashed and dashless CNICs inside text", () => {
    expect("cnic: 34101-9721875-9 ok".match(CNIC_PATTERN)?.[0]).toBe("34101-9721875-9");
    expect("cnic: 3410197218759 ok".match(CNIC_PATTERN)?.[0]).toBe("3410197218759");
  });
});

describe("parseOcrResponse", () => {
  it("parses a clean dashed CNIC", () => {
    expect(parseOcrResponse("34101-9721875-9")).toEqual({
      readable: true,
      digits: "3410197218759",
      formatted: "34101-9721875-9",
    });
  });

  it("parses a dashless CNIC and formats it", () => {
    const result = parseOcrResponse("3410197218759");
    expect(result.readable).toBe(true);
    expect(result.formatted).toBe("34101-9721875-9");
  });

  it("parses a partially dashed CNIC (dashes are optional independently)", () => {
    const result = parseOcrResponse("34101-97218759");
    expect(result.readable).toBe(true);
    expect(result.digits).toBe("3410197218759");
  });

  it("extracts a CNIC embedded in OCR prose", () => {
    const text = "PAKISTAN Identity Card\nName: Ali\nNumber: 34101-9721875-9\nDOB 01.01.1990";
    const result = parseOcrResponse(text);
    expect(result.readable).toBe(true);
    expect(result.digits).toBe("3410197218759");
  });

  it("treats the NOT_FOUND sentinel as unreadable", () => {
    expect(parseOcrResponse("NOT_FOUND")).toEqual({
      readable: false,
      digits: null,
      formatted: null,
    });
  });

  it("treats empty / null / whitespace as unreadable", () => {
    expect(parseOcrResponse("").readable).toBe(false);
    expect(parseOcrResponse(null).readable).toBe(false);
    expect(parseOcrResponse("   ").readable).toBe(false);
  });

  it("treats text without any CNIC as unreadable", () => {
    expect(parseOcrResponse("Sorry, the image is too blurry to read.").readable).toBe(false);
  });

  it("treats a 12-digit number as unreadable (too short)", () => {
    expect(parseOcrResponse("341019721875").readable).toBe(false);
  });

  it("takes the first 13 digits when the OCR text has a longer digit run", () => {
    // Documented actual behavior: the pattern grabs the first 13-digit window.
    const result = parseOcrResponse("34101972187599");
    expect(result.readable).toBe(true);
    expect(result.digits).toBe("3410197218759");
  });
});
