import { describe, it, expect, afterEach, vi } from "vitest";
import { generateNumericOtp, getEmailOtpExpiryDate } from "../../../src/utils/otp.js";

describe("generateNumericOtp", () => {
  it("produces 6 digits by default", () => {
    const otp = generateNumericOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("never produces a leading zero (stays within the 6-digit range)", () => {
    // 50 samples all inside [100000, 999999] — a leading zero would
    // fall below the lower bound.
    for (let i = 0; i < 50; i++) {
      const value = Number(generateNumericOtp());
      expect(value).toBeGreaterThanOrEqual(100000);
      expect(value).toBeLessThanOrEqual(999999);
    }
  });

  it("honors a custom length", () => {
    expect(generateNumericOtp(4)).toMatch(/^\d{4}$/);
    expect(generateNumericOtp(8)).toMatch(/^\d{8}$/);
  });

  it("returns a string, not a number", () => {
    expect(typeof generateNumericOtp()).toBe("string");
  });
});

describe("getEmailOtpExpiryDate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("defaults to 1 minute from now when the env var is unset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T10:00:00Z"));
    vi.stubEnv("EMAIL_OTP_EXPIRES_MINUTES", undefined);
    expect(getEmailOtpExpiryDate().toISOString()).toBe("2026-07-16T10:01:00.000Z");
  });

  it("uses the configured number of minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T10:00:00Z"));
    vi.stubEnv("EMAIL_OTP_EXPIRES_MINUTES", "5");
    expect(getEmailOtpExpiryDate().toISOString()).toBe("2026-07-16T10:05:00.000Z");
  });

  it("falls back to 1 minute when the env var is not a number", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T10:00:00Z"));
    vi.stubEnv("EMAIL_OTP_EXPIRES_MINUTES", "abc");
    expect(getEmailOtpExpiryDate().toISOString()).toBe("2026-07-16T10:01:00.000Z");
  });

  it("falls back to 1 minute when the env var is zero or negative", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T10:00:00Z"));
    vi.stubEnv("EMAIL_OTP_EXPIRES_MINUTES", "0");
    expect(getEmailOtpExpiryDate().toISOString()).toBe("2026-07-16T10:01:00.000Z");
    vi.stubEnv("EMAIL_OTP_EXPIRES_MINUTES", "-3");
    expect(getEmailOtpExpiryDate().toISOString()).toBe("2026-07-16T10:01:00.000Z");
  });
});
