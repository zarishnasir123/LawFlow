import { describe, it, expect } from "vitest";
import { notificationActionPath } from "./notifications";

describe("notificationActionPath", () => {
  it("routes any payout notification to /payouts", () => {
    expect(notificationActionPath("payout_requested")).toBe("/payouts");
    expect(notificationActionPath("payout_paid")).toBe("/payouts");
  });

  it("routes a pending-verification notification to /verifications", () => {
    expect(notificationActionPath("lawyer_pending_verification")).toBe("/verifications");
  });

  it("returns undefined for notification types with no landing page", () => {
    expect(notificationActionPath("case_submitted")).toBeUndefined();
    expect(notificationActionPath("")).toBeUndefined();
  });
});
