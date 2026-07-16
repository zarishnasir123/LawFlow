import { describe, it, expect } from "vitest";
import {
  getNextHearingStage,
  CIVIL_STAGES,
  FAMILY_STAGES,
} from "../../../../src/modules/hearings/hearingScheduler.js";

describe("getNextHearingStage", () => {
  it("walks the civil stages in order", () => {
    CIVIL_STAGES.forEach((stage, index) => {
      expect(getNextHearingStage("civil", index)).toBe(stage);
    });
  });

  it("walks the family stages in order", () => {
    FAMILY_STAGES.forEach((stage, index) => {
      expect(getNextHearingStage("family", index)).toBe(stage);
    });
  });

  it("starts every case type with First Appearance / Summons", () => {
    expect(getNextHearingStage("civil", 0)).toBe("First Appearance / Summons");
    expect(getNextHearingStage("family", 0)).toBe("First Appearance / Summons");
  });

  it("labels hearings beyond the last stage as Interim / Miscellaneous", () => {
    expect(getNextHearingStage("civil", CIVIL_STAGES.length)).toBe("Interim / Miscellaneous");
    expect(getNextHearingStage("family", FAMILY_STAGES.length)).toBe("Interim / Miscellaneous");
    expect(getNextHearingStage("civil", 99)).toBe("Interim / Miscellaneous");
  });

  it("is case-insensitive and trims the category", () => {
    expect(getNextHearingStage("FAMILY", 2)).toBe(FAMILY_STAGES[2]);
    expect(getNextHearingStage("  Family  ", 2)).toBe(FAMILY_STAGES[2]);
  });

  it("defaults unknown or missing categories to the civil track", () => {
    expect(getNextHearingStage("criminal", 1)).toBe(CIVIL_STAGES[1]);
    expect(getNextHearingStage(null, 1)).toBe(CIVIL_STAGES[1]);
    expect(getNextHearingStage(undefined, 0)).toBe(CIVIL_STAGES[0]);
  });
});
