import { describe, it, expect } from "vitest";
import { getApiErrorMessage } from "./getApiErrorMessage";

describe("getApiErrorMessage", () => {
  it("pulls the backend { message } out of an axios-shaped error", () => {
    const err = { response: { data: { message: "Email is already registered" } } };
    expect(getApiErrorMessage(err)).toBe("Email is already registered");
  });

  it("uses the default fallback when there is no message", () => {
    expect(getApiErrorMessage({})).toBe("Something went wrong. Please try again.");
    expect(getApiErrorMessage({ response: {} })).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("honors a custom fallback", () => {
    expect(getApiErrorMessage(null, "Login failed")).toBe("Login failed");
  });

  it("handles primitive and nullish errors safely", () => {
    expect(getApiErrorMessage("boom")).toContain("Something went wrong");
    expect(getApiErrorMessage(undefined)).toContain("Something went wrong");
  });
});
