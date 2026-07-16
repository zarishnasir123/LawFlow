import { describe, it, expect, afterEach, vi } from "vitest";

// The "disabled outside production" flag is computed at module load, so each
// test imports a FRESH copy of the module with the env it needs.
async function loadRateLimiter(nodeEnv) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  return await import("../../../src/middleware/rateLimiter.js");
}

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const req = (ip = "1.2.3.4") => ({ ip });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("rateLimiter", () => {
  it("is a pass-through outside production (local dev is never throttled)", async () => {
    const { rateLimiter } = await loadRateLimiter("test");
    const limiter = rateLimiter({ windowMs: 1000, max: 1, message: "slow down" });
    for (let i = 0; i < 10; i++) {
      const next = vi.fn();
      limiter(req(), mockRes(), next);
      expect(next).toHaveBeenCalled();
    }
  });

  it("allows requests under the cap in production", async () => {
    const { rateLimiter } = await loadRateLimiter("production");
    const limiter = rateLimiter({ windowMs: 60_000, max: 3, message: "slow down" });
    for (let i = 0; i < 3; i++) {
      const next = vi.fn();
      limiter(req(), mockRes(), next);
      expect(next).toHaveBeenCalled();
    }
  });

  it("answers 429 with the configured message once the cap is hit", async () => {
    const { rateLimiter } = await loadRateLimiter("production");
    const limiter = rateLimiter({ windowMs: 60_000, max: 2, message: "Too many attempts." });
    limiter(req(), mockRes(), vi.fn());
    limiter(req(), mockRes(), vi.fn());
    const res = mockRes();
    const next = vi.fn();
    limiter(req(), res, next);
    expect(res.statusCode).toBe(429);
    expect(res.body.message).toBe("Too many attempts.");
    expect(next).not.toHaveBeenCalled();
  });

  it("resets the counter after the window passes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T10:00:00Z"));
    const { rateLimiter } = await loadRateLimiter("production");
    const limiter = rateLimiter({ windowMs: 60_000, max: 1, message: "slow down" });

    limiter(req(), mockRes(), vi.fn());
    const blocked = mockRes();
    limiter(req(), blocked, vi.fn());
    expect(blocked.statusCode).toBe(429);

    vi.setSystemTime(new Date("2026-07-16T10:01:01Z")); // window elapsed
    const next = vi.fn();
    limiter(req(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("tracks each IP separately", async () => {
    const { rateLimiter } = await loadRateLimiter("production");
    const limiter = rateLimiter({ windowMs: 60_000, max: 1, message: "slow down" });
    limiter(req("1.1.1.1"), mockRes(), vi.fn());
    const otherIpNext = vi.fn();
    limiter(req("2.2.2.2"), mockRes(), otherIpNext);
    expect(otherIpNext).toHaveBeenCalled(); // fresh counter for the new IP
    const blocked = mockRes();
    limiter(req("1.1.1.1"), blocked, vi.fn());
    expect(blocked.statusCode).toBe(429); // first IP still capped
  });

  it("exports a named limiter for every sensitive route group", async () => {
    const mod = await loadRateLimiter("test");
    for (const name of [
      "forgotPasswordLimiter",
      "resetPasswordLimiter",
      "loginLimiter",
      "registerLimiter",
      "otpResendLimiter",
      "lawyerReviewLimiter",
      "registrarManagementLimiter",
      "registrarCredentialsLimiter",
      "aiGuidanceLimiter",
    ]) {
      expect(typeof mod[name], `${name} should be middleware`).toBe("function");
    }
  });
});
