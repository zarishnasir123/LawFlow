import { describe, it, expect } from "vitest";
import { formatCaseTitle, formatCaseSelectLabel } from "./caseDisplay";

describe("formatCaseTitle", () => {
  it("prefers the lawyer-entered title", () => {
    expect(
      formatCaseTitle({ caseTitle: "Khan property suit", caseTypeName: "Civil", clientName: "Ali" })
    ).toBe("Khan property suit");
  });

  it("falls back to the case type, then the client name", () => {
    expect(formatCaseTitle({ caseTitle: "  ", caseTypeName: "Civil Recovery" })).toBe(
      "Civil Recovery"
    );
    expect(formatCaseTitle({ clientName: "Ali Khan" })).toBe("Ali Khan");
  });

  it('uses "Case" when nothing is provided', () => {
    expect(formatCaseTitle({})).toBe("Case");
  });
});

describe("formatCaseSelectLabel", () => {
  it("joins title and type with a middot when both exist", () => {
    expect(formatCaseSelectLabel({ caseTitle: "Khan suit", caseTypeName: "Civil" })).toBe(
      "Khan suit · Civil"
    );
  });

  it("falls back to the plain title logic when one is missing", () => {
    expect(formatCaseSelectLabel({ caseTypeName: "Civil" })).toBe("Civil");
  });
});
