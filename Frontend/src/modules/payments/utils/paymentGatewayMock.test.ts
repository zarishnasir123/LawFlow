import { describe, it, expect } from "vitest";
import {
  getPaymentMethodLabel,
  normalizeCardNumber,
  formatCardNumber,
  normalizeExpiry,
  normalizeCvc,
  validateStripeLikeFields,
  simulateGatewayResult,
  type StripeLikeFormValues,
} from "./paymentGatewayMock";

const form = (over: Partial<StripeLikeFormValues> = {}): StripeLikeFormValues => ({
  method: "card",
  amount: 5000,
  cardholderName: "Ali Khan",
  cardNumber: "4242424242424242",
  expiry: "12/28",
  cvc: "123",
  ...over,
});

describe("getPaymentMethodLabel", () => {
  it("humanizes the method key", () => {
    expect(getPaymentMethodLabel("bank_transfer")).toBe("Bank Transfer");
    expect(getPaymentMethodLabel("safepay")).toBe("Safepay");
  });
});

describe("card field normalizers", () => {
  it("keeps digits only, capped at 16", () => {
    expect(normalizeCardNumber("4242-4242-4242-4242-9999")).toBe("4242424242424242");
  });

  it("formats the card number in groups of four", () => {
    expect(formatCardNumber("4242424242424242")).toBe("4242 4242 4242 4242");
  });

  it("masks the expiry as MM/YY", () => {
    expect(normalizeExpiry("1228")).toBe("12/28");
    expect(normalizeExpiry("1")).toBe("1");
  });

  it("keeps the CVC to 3-4 digits", () => {
    expect(normalizeCvc("12345")).toBe("1234");
    expect(normalizeCvc("12a")).toBe("12");
  });
});

describe("validateStripeLikeFields", () => {
  it("passes a fully valid card form", () => {
    expect(validateStripeLikeFields(form())).toEqual({ valid: true });
  });

  it("rejects a non-positive amount", () => {
    expect(validateStripeLikeFields(form({ amount: 0 })).valid).toBe(false);
  });

  it("skips card checks for non-card methods", () => {
    expect(validateStripeLikeFields(form({ method: "cash", cardNumber: "" })).valid).toBe(true);
  });

  it("flags missing name, short card, bad expiry, and bad CVC", () => {
    expect(validateStripeLikeFields(form({ cardholderName: "  " })).message).toMatch(/name/i);
    expect(validateStripeLikeFields(form({ cardNumber: "4242" })).message).toMatch(/16 digits/);
    expect(validateStripeLikeFields(form({ expiry: "13/28" })).message).toMatch(/month/i);
    expect(validateStripeLikeFields(form({ cvc: "12" })).message).toMatch(/CVC/);
  });
});

describe("simulateGatewayResult", () => {
  it("declines a card ending 0002 and marks 9999 unavailable", () => {
    expect(simulateGatewayResult(form({ cardNumber: "4000000000000002" })).outcome).toBe(
      "declined"
    );
    expect(simulateGatewayResult(form({ cardNumber: "4000000000009999" })).outcome).toBe(
      "unavailable"
    );
  });

  it("succeeds for any other card and for non-card methods", () => {
    expect(simulateGatewayResult(form()).outcome).toBe("success");
    expect(simulateGatewayResult(form({ method: "cash" })).outcome).toBe("success");
  });
});
