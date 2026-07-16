import { describe, it, expect, beforeEach, vi } from "vitest";

// The activity ledger fires a pool.query — mock it so no database is touched.
const recordActivityMock = vi.fn();
vi.mock("../../../src/services/activityTracker.service.js", () => ({
  recordActivity: (...args) => recordActivityMock(...args),
}));

const { authenticate } = await import("../../../src/middleware/authenticate.js");
const { signAccessToken } = await import("../../../src/utils/tokens.js");

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

beforeEach(() => recordActivityMock.mockReset());

describe("authenticate", () => {
  it("answers 401 when no Authorization header is present", () => {
    const res = mockRes();
    const next = vi.fn();
    authenticate({ headers: {} }, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Authentication required");
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 401 for a non-Bearer scheme", () => {
    const res = mockRes();
    authenticate({ headers: { authorization: "Basic abc123" } }, res, vi.fn());
    expect(res.statusCode).toBe(401);
  });

  it("answers 401 for a garbage token", () => {
    const res = mockRes();
    authenticate({ headers: { authorization: "Bearer not-a-jwt" } }, res, vi.fn());
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
  });

  it("attaches the decoded user and calls next() for a valid token", () => {
    const token = signAccessToken({ sub: "user-1", role: "lawyer" });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = vi.fn();
    authenticate(req, mockRes(), next);
    expect(req.user.sub).toBe("user-1");
    expect(req.user.role).toBe("lawyer");
    expect(next).toHaveBeenCalled();
  });

  it("records daily activity with the user id (fire-and-forget ledger)", () => {
    const token = signAccessToken({ sub: "user-42", role: "client" });
    authenticate({ headers: { authorization: `Bearer ${token}` } }, mockRes(), vi.fn());
    expect(recordActivityMock).toHaveBeenCalledWith("user-42");
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T10:00:00Z"));
    vi.stubEnv("ACCESS_TOKEN_EXPIRES_IN", "1s");
    const token = signAccessToken({ sub: "user-1", role: "client" });
    vi.setSystemTime(new Date("2026-07-16T10:00:05Z"));
    const res = mockRes();
    authenticate({ headers: { authorization: `Bearer ${token}` } }, res, vi.fn());
    expect(res.statusCode).toBe(401);
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });
});
