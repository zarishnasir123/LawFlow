import { describe, it, expect } from "vitest";
import {
  formatCnic,
  cnicDigits,
  cnicSkeleton,
  cnicCaretPos,
  formatPkPhone,
  isAllowedGujranwalaCnic,
  ALLOWED_CNIC_PREFIXES,
  GUJRANWALA_TEHSILS,
} from "./pkFormat";

describe("formatCnic", () => {
  it("inserts dashes at positions 5 and 12 as digits are typed", () => {
    expect(formatCnic("34104")).toBe("34104");
    expect(formatCnic("341041234567")).toBe("34104-1234567");
    expect(formatCnic("3410412345671")).toBe("34104-1234567-1");
  });

  it("strips non-digits and caps at 13 digits", () => {
    expect(formatCnic("34104-1234567-1")).toBe("34104-1234567-1");
    expect(formatCnic("34104a1234567b1extra")).toBe("34104-1234567-1");
  });

  it("returns empty string for empty / nullish input", () => {
    expect(formatCnic("")).toBe("");
    expect(formatCnic(undefined as unknown as string)).toBe("");
  });
});

describe("cnicDigits", () => {
  it("returns only digits, capped at 13", () => {
    expect(cnicDigits("34104-1234567-1")).toBe("3410412345671");
    expect(cnicDigits("3410412345671999")).toBe("3410412345671");
    expect(cnicDigits("abc")).toBe("");
  });
});

describe("cnicSkeleton", () => {
  it("shows the full underscore template when empty", () => {
    expect(cnicSkeleton("")).toBe("_____-_______-_");
  });

  it("fills slots left to right, dashes never move", () => {
    expect(cnicSkeleton("34104")).toBe("34104-_______-_");
    expect(cnicSkeleton("341041234567")).toBe("34104-1234567-_");
    expect(cnicSkeleton("3410412345671")).toBe("34104-1234567-1");
  });
});

describe("cnicCaretPos", () => {
  it("sits on the next empty slot, jumping over both dashes", () => {
    expect(cnicCaretPos(0)).toBe(0);
    expect(cnicCaretPos(4)).toBe(4); // still in first group
    expect(cnicCaretPos(5)).toBe(6); // jumped the first dash
    expect(cnicCaretPos(11)).toBe(12);
    expect(cnicCaretPos(12)).toBe(14); // on the final single-digit slot
    expect(cnicCaretPos(13)).toBe(15); // complete
  });
});

describe("formatPkPhone", () => {
  it("always shows the +92- prefix, even when empty", () => {
    expect(formatPkPhone("")).toBe("+92-");
  });

  it("accepts 0300…, 92300…, +92300…, and bare 300…", () => {
    expect(formatPkPhone("03001234567")).toBe("+92-300-1234567");
    expect(formatPkPhone("923001234567")).toBe("+92-300-1234567");
    expect(formatPkPhone("+92-300-1234567")).toBe("+92-300-1234567");
    expect(formatPkPhone("3001234567")).toBe("+92-300-1234567");
  });

  it("caps the local part at 10 digits", () => {
    expect(formatPkPhone("030012345679999")).toBe("+92-300-1234567");
  });

  it("groups the area code before the dash", () => {
    expect(formatPkPhone("300")).toBe("+92-300");
    expect(formatPkPhone("3001")).toBe("+92-300-1");
  });
});

describe("isAllowedGujranwalaCnic", () => {
  it("accepts every allowed Gujranwala prefix", () => {
    for (const prefix of ALLOWED_CNIC_PREFIXES) {
      expect(isAllowedGujranwalaCnic(`${prefix}-1234567-1`), prefix).toBe(true);
    }
  });

  it("rejects a non-Gujranwala prefix", () => {
    expect(isAllowedGujranwalaCnic("35202-1234567-1")).toBe(false);
    expect(isAllowedGujranwalaCnic("34107-1234567-1")).toBe(false);
  });

  it("handles partial input and nullish safely", () => {
    expect(isAllowedGujranwalaCnic("341")).toBe(false);
    expect(isAllowedGujranwalaCnic("")).toBe(false);
    expect(isAllowedGujranwalaCnic(undefined as unknown as string)).toBe(false);
  });
});

describe("GUJRANWALA_TEHSILS", () => {
  it("lists the four served tehsils", () => {
    expect(GUJRANWALA_TEHSILS).toContain("Kamoke");
    expect(GUJRANWALA_TEHSILS).toContain("Wazirabad");
    expect(GUJRANWALA_TEHSILS).toHaveLength(4);
  });
});
