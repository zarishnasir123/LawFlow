import { describe, it, expect } from "vitest";
import { deriveSignatureBadge } from "./pageSignatures";

describe("deriveSignatureBadge", () => {
  it("returns null when nothing is signed or status is missing", () => {
    expect(deriveSignatureBadge(undefined)).toBeNull();
    expect(deriveSignatureBadge({ clientSigned: false, lawyerSigned: false })).toBeNull();
  });

  it("shows a green badge when both signed", () => {
    const badge = deriveSignatureBadge({ clientSigned: true, lawyerSigned: true });
    expect(badge?.label).toBe("Client + Lawyer Signed");
    expect(badge?.className).toMatch(/emerald/);
  });

  it("shows an amber badge for client-only", () => {
    const badge = deriveSignatureBadge({ clientSigned: true, lawyerSigned: false });
    expect(badge?.label).toBe("Client Signed");
    expect(badge?.className).toMatch(/amber/);
  });

  it("shows an indigo badge for lawyer-only", () => {
    const badge = deriveSignatureBadge({ clientSigned: false, lawyerSigned: true });
    expect(badge?.label).toBe("Lawyer Signed");
    expect(badge?.className).toMatch(/indigo/);
  });
});
