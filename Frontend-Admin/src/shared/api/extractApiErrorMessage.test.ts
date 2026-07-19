import { describe, it, expect } from "vitest";
import { AxiosError } from "axios";
import { extractApiErrorMessage } from "./extractApiErrorMessage";

function axiosErrorWith(data: unknown): AxiosError {
  const err = new AxiosError("Request failed");
  // Attach a minimal response so the extractor sees our payload.
  err.response = { data } as AxiosError["response"];
  return err;
}

describe("extractApiErrorMessage", () => {
  it('pulls the single { message } shape', () => {
    expect(
      extractApiErrorMessage(axiosErrorWith({ message: "Email is already registered" }), "fb")
    ).toBe("Email is already registered");
  });

  it("pulls the first msg from an express-validator { errors:[{msg}] } shape", () => {
    expect(
      extractApiErrorMessage(
        axiosErrorWith({ errors: [{ msg: "CNIC must follow Pakistan format" }] }),
        "fb"
      )
    ).toBe("CNIC must follow Pakistan format");
  });

  it("prefers message over errors when both are present", () => {
    expect(
      extractApiErrorMessage(
        axiosErrorWith({ message: "top-level", errors: [{ msg: "field-level" }] }),
        "fb"
      )
    ).toBe("top-level");
  });

  it("uses the axios error's own message when the body is unrecognized", () => {
    // AxiosError IS an Error, so it falls through to error.message, not the
    // caller fallback. The fallback is only for non-Error values.
    expect(extractApiErrorMessage(axiosErrorWith({ weird: true }), "fallback")).toBe(
      "Request failed"
    );
  });

  it("uses a plain Error's message", () => {
    expect(extractApiErrorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("uses the fallback for non-error values", () => {
    expect(extractApiErrorMessage("nope", "fallback")).toBe("fallback");
    expect(extractApiErrorMessage(null, "fallback")).toBe("fallback");
  });
});
