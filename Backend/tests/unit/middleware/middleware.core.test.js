import { describe, it, expect, vi } from "vitest";
import { body } from "express-validator";
import { asyncHandler } from "../../../src/middleware/asyncHandler.js";
import { authorizeRoles } from "../../../src/middleware/authorizeRoles.js";
import { validateRequest } from "../../../src/middleware/validateRequest.js";
import { notFoundHandler } from "../../../src/middleware/notFoundHandler.js";
import { errorHandler } from "../../../src/middleware/errorHandler.js";
import { ApiError } from "../../../src/utils/apiError.js";

// Minimal Express response stand-in: records status + JSON body.
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

describe("asyncHandler", () => {
  it("passes a rejected promise to next()", async () => {
    const boom = new Error("db down");
    const next = vi.fn();
    await asyncHandler(async () => {
      throw boom;
    })({}, {}, next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it("lets a synchronous throw propagate (Express catches those natively)", () => {
    // Documented actual behavior: only PROMISE rejections are routed to
    // next(); a sync throw escapes before Promise.resolve can wrap it.
    const boom = new Error("sync fail");
    expect(() =>
      asyncHandler(() => {
        throw boom;
      })({}, {}, vi.fn())
    ).toThrow("sync fail");
  });

  it("does not call next(error) when the handler succeeds", async () => {
    const next = vi.fn();
    await asyncHandler(async (req, res) => res.json({ ok: 1 }))({}, mockRes(), next);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("authorizeRoles", () => {
  it("answers 401 when no user is attached (authenticate did not run)", () => {
    const res = mockRes();
    const next = vi.fn();
    authorizeRoles("admin")({}, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 403 when the role is not allowed", () => {
    const res = mockRes();
    const next = vi.fn();
    authorizeRoles("admin")({ user: { role: "client" } }, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Access denied");
    expect(next).not.toHaveBeenCalled();
  });

  it("lets an allowed role through", () => {
    const next = vi.fn();
    authorizeRoles("lawyer")({ user: { role: "lawyer" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("supports multiple allowed roles", () => {
    const next = vi.fn();
    authorizeRoles("lawyer", "client")({ user: { role: "client" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("denies everyone when no roles are allowed (empty gate)", () => {
    const res = mockRes();
    const next = vi.fn();
    authorizeRoles()({ user: { role: "admin" } }, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("validateRequest", () => {
  it("calls next() when there are no validation errors", async () => {
    const req = { body: { email: "a@b.com" } };
    await body("email").isEmail().run(req);
    const next = vi.fn();
    validateRequest(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("answers 400 with an errors array when validation failed", async () => {
    const req = { body: { email: "not-an-email" } };
    await body("email").isEmail().withMessage("Invalid email").run(req);
    const res = mockRes();
    const next = vi.fn();
    validateRequest(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors[0].msg).toBe("Invalid email");
    expect(next).not.toHaveBeenCalled();
  });
});

describe("notFoundHandler", () => {
  it("answers 404 with a clean JSON message", () => {
    const res = mockRes();
    notFoundHandler({}, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: "Route not found" });
  });
});

describe("errorHandler", () => {
  it("uses the ApiError status code and message", () => {
    const res = mockRes();
    errorHandler(new ApiError(409, "Email is already registered"), {}, res, vi.fn());
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ message: "Email is already registered" });
  });

  it("falls back to error.status when statusCode is absent", () => {
    const err = new Error("teapot");
    err.status = 418;
    const res = mockRes();
    errorHandler(err, {}, res, vi.fn());
    expect(res.statusCode).toBe(418);
  });

  it("defaults unexpected errors to 500", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = mockRes();
    errorHandler(new Error("undefined is not a function"), {}, res, vi.fn());
    expect(res.statusCode).toBe(500);
    spy.mockRestore();
  });

  it("maps malformed JSON bodies to a friendly 400", () => {
    const err = new Error("Unexpected token");
    err.type = "entity.parse.failed";
    const res = mockRes();
    errorHandler(err, {}, res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: "Invalid JSON body" });
  });

  it("logs server errors but stays quiet for client errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    errorHandler(new ApiError(400, "bad input"), {}, mockRes(), vi.fn());
    expect(spy).not.toHaveBeenCalled();
    errorHandler(new Error("boom"), {}, mockRes(), vi.fn());
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("uses a generic message when the error has none", () => {
    const err = new Error();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = mockRes();
    errorHandler(err, {}, res, vi.fn());
    expect(res.body.message).toBe("Internal server error");
    spy.mockRestore();
  });
});
