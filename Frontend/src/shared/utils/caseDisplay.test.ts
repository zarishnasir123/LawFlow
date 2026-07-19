import { describe, it, expect } from "vitest";
import { getCaseDisplayTitle } from "./caseDisplay";

describe("getCaseDisplayTitle", () => {
  it("returns a real lawyer-entered title unchanged", () => {
    expect(getCaseDisplayTitle("Khan vs Ahmed — property dispute")).toBe(
      "Khan vs Ahmed — property dispute"
    );
  });

  it('falls back to "Case File" for empty or missing titles', () => {
    expect(getCaseDisplayTitle("")).toBe("Case File");
    expect(getCaseDisplayTitle(null)).toBe("Case File");
    expect(getCaseDisplayTitle("   ")).toBe("Case File");
  });

  it('hides an auto-generated "Case <id>" placeholder', () => {
    expect(getCaseDisplayTitle("Case abc-123-def", "abc-123-def")).toBe("Case File");
  });

  it("hides long random-looking auto titles", () => {
    expect(getCaseDisplayTitle("Case 1718123456789")).toBe("Case File");
    expect(getCaseDisplayTitle("Case a1b2c3d4e5f6")).toBe("Case File");
  });

  it("keeps a human title that merely starts with the word Case", () => {
    expect(getCaseDisplayTitle("Case of the missing dowry")).toBe(
      "Case of the missing dowry"
    );
  });
});
