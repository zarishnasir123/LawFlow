import { describe, it, expect } from "vitest";
import { ApiError } from "../../../src/utils/apiError.js";

describe("ApiError", () => {
  it("stores the HTTP status code and message", () => {
    const err = new ApiError(404, "Case not found");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Case not found");
  });

  it("is a real Error (instanceof works for error middleware)", () => {
    const err = new ApiError(500, "boom");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });

  it("carries a stack trace for server-side logging", () => {
    const err = new ApiError(400, "bad input");
    expect(typeof err.stack).toBe("string");
    expect(err.stack.length).toBeGreaterThan(0);
  });

  it("can be thrown and caught like any error", () => {
    expect(() => {
      throw new ApiError(403, "Not allowed");
    }).toThrow("Not allowed");
  });
});
