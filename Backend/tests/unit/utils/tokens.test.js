import { describe, it, expect, afterEach, vi } from "vitest";
import {
  parseDurationToMilliseconds,
  getRefreshTokenDuration,
  getRefreshTokenExpiryDate,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  signReactivationToken,
  verifyReactivationToken,
} from "../../../src/utils/tokens.js";

// unit.setup.js provides JWT_ACCESS_SECRET / JWT_REFRESH_SECRET.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("parseDurationToMilliseconds", () => {
  it("parses seconds, minutes, hours, and days", () => {
    expect(parseDurationToMilliseconds("30s")).toBe(30_000);
    expect(parseDurationToMilliseconds("15m")).toBe(900_000);
    expect(parseDurationToMilliseconds("8h")).toBe(28_800_000);
    expect(parseDurationToMilliseconds("7d")).toBe(604_800_000);
  });

  it("uses the fallback when the duration is empty", () => {
    expect(parseDurationToMilliseconds(undefined)).toBe(604_800_000); // "7d"
    expect(parseDurationToMilliseconds(null, "1h")).toBe(3_600_000);
    expect(parseDurationToMilliseconds("", "30s")).toBe(30_000);
  });

  it("throws on formats it does not understand", () => {
    expect(() => parseDurationToMilliseconds("10w")).toThrow(/Invalid token duration/);
    expect(() => parseDurationToMilliseconds("abc")).toThrow(/Invalid token duration/);
    expect(() => parseDurationToMilliseconds("d7")).toThrow(/Invalid token duration/);
    expect(() => parseDurationToMilliseconds("15 m")).toThrow(/Invalid token duration/);
  });
});

describe("getRefreshTokenDuration", () => {
  it("uses the 8-hour session default when rememberMe is off and no env is set", () => {
    vi.stubEnv("SESSION_REFRESH_TOKEN_EXPIRES_IN", undefined);
    expect(getRefreshTokenDuration(false)).toBe("8h");
    expect(getRefreshTokenDuration()).toBe("8h");
  });

  it("uses SESSION_REFRESH_TOKEN_EXPIRES_IN when set and rememberMe is off", () => {
    vi.stubEnv("SESSION_REFRESH_TOKEN_EXPIRES_IN", "4h");
    expect(getRefreshTokenDuration(false)).toBe("4h");
  });

  it("uses the 7-day default when rememberMe is on and no env is set", () => {
    vi.stubEnv("REMEMBER_ME_REFRESH_TOKEN_EXPIRES_IN", undefined);
    vi.stubEnv("REFRESH_TOKEN_EXPIRES_IN", undefined);
    expect(getRefreshTokenDuration(true)).toBe("7d");
  });

  it("prefers REMEMBER_ME_REFRESH_TOKEN_EXPIRES_IN over REFRESH_TOKEN_EXPIRES_IN", () => {
    vi.stubEnv("REMEMBER_ME_REFRESH_TOKEN_EXPIRES_IN", "30d");
    vi.stubEnv("REFRESH_TOKEN_EXPIRES_IN", "14d");
    expect(getRefreshTokenDuration(true)).toBe("30d");
  });

  it("falls back to REFRESH_TOKEN_EXPIRES_IN when the rememberMe-specific var is unset", () => {
    vi.stubEnv("REMEMBER_ME_REFRESH_TOKEN_EXPIRES_IN", undefined);
    vi.stubEnv("REFRESH_TOKEN_EXPIRES_IN", "14d");
    expect(getRefreshTokenDuration(true)).toBe("14d");
  });
});

describe("getRefreshTokenExpiryDate", () => {
  it("adds the parsed duration to the current time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T10:00:00Z"));
    expect(getRefreshTokenExpiryDate("8h").toISOString()).toBe("2026-07-16T18:00:00.000Z");
  });
});

describe("access / refresh token round trips", () => {
  it("signs and verifies an access token, preserving the payload", () => {
    const token = signAccessToken({ sub: "user-1", role: "client" });
    const claims = verifyAccessToken(token);
    expect(claims.sub).toBe("user-1");
    expect(claims.role).toBe("client");
    expect(typeof claims.exp).toBe("number");
  });

  it("signs and verifies a refresh token", () => {
    const token = signRefreshToken({ sub: "user-2" });
    expect(verifyRefreshToken(token).sub).toBe("user-2");
  });

  it("rejects an access token presented as a refresh token (different secrets)", () => {
    const token = signAccessToken({ sub: "user-1" });
    expect(() => verifyRefreshToken(token)).toThrow();
  });

  it("rejects a token signed with the wrong secret", () => {
    vi.stubEnv("JWT_ACCESS_SECRET", "attacker-secret");
    const forged = signAccessToken({ sub: "user-1" });
    vi.unstubAllEnvs();
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it("rejects an expired refresh token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T10:00:00Z"));
    const token = signRefreshToken({ sub: "user-3" }, "1s");
    vi.setSystemTime(new Date("2026-07-16T10:00:05Z"));
    expect(() => verifyRefreshToken(token)).toThrow(/expired/i);
  });

  it("rejects garbage tokens", () => {
    expect(() => verifyAccessToken("not-a-token")).toThrow();
  });
});

describe("reactivation tokens", () => {
  it("round-trips and carries the reactivate purpose", () => {
    const token = signReactivationToken({ sub: "user-9" });
    const claims = verifyReactivationToken(token);
    expect(claims.sub).toBe("user-9");
    expect(claims.purpose).toBe("reactivate");
  });

  it("refuses a plain access token used as a reactivation token", () => {
    // Same secret, but no purpose claim — the namespace check must catch it.
    const token = signAccessToken({ sub: "user-9" });
    expect(() => verifyReactivationToken(token)).toThrow(/not a reactivation token/);
  });
});
