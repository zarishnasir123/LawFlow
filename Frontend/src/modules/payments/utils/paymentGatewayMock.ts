import type { PaymentMethod } from "../types/payments";

export type MockGatewayOutcome = "success" | "declined" | "unavailable";

export type StripeLikeFormValues = {
  method: PaymentMethod;
  amount: number;
  cardholderName: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
};

export function getPaymentMethodLabel(method: PaymentMethod): string {
  return method
    .replace(/_/g, " ")
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export function normalizeCardNumber(value: string): string {
  return value.replace(/\D/g, "").slice(0, 16);
}

export function formatCardNumber(value: string): string {
  const digits = normalizeCardNumber(value);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function normalizeExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function normalizeCvc(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function validateStripeLikeFields(input: StripeLikeFormValues): {
  valid: boolean;
  message?: string;
} {
  if (input.amount <= 0) {
    return { valid: false, message: "Amount must be greater than zero." };
  }

  const cardMethod = input.method === "card" || input.method === "stripe";
  if (!cardMethod) return { valid: true };

  const digits = normalizeCardNumber(input.cardNumber);
  if (!input.cardholderName.trim()) {
    return { valid: false, message: "Cardholder name is required." };
  }
  if (digits.length < 16) {
    return { valid: false, message: "Card number must be 16 digits." };
  }
  if (!/^\d{2}\/\d{2}$/.test(input.expiry)) {
    return { valid: false, message: "Expiry must be in MM/YY format." };
  }

  const month = Number(input.expiry.slice(0, 2));
  if (month < 1 || month > 12) {
    return { valid: false, message: "Expiry month is invalid." };
  }

  if (!/^\d{3,4}$/.test(input.cvc)) {
    return { valid: false, message: "CVC must be 3 or 4 digits." };
  }

  return { valid: true };
}

export function simulateGatewayResult(input: StripeLikeFormValues): {
  outcome: MockGatewayOutcome;
  message: string;
} {
  const cardMethod = input.method === "card" || input.method === "stripe";
  if (!cardMethod) {
    return {
      outcome: "success",
      message: "Payment completed successfully.",
    };
  }

  const digits = normalizeCardNumber(input.cardNumber);
  const last4 = digits.slice(-4);

  if (last4 === "0002") {
    return {
      outcome: "declined",
      message: "Payment declined by issuer. Please try another method.",
    };
  }

  if (last4 === "9999") {
    return {
      outcome: "unavailable",
      message: "Payment service is currently unavailable. Please try again later.",
    };
  }

  return {
    outcome: "success",
    message: "Payment authorized successfully.",
  };
}
