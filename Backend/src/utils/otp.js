import { randomInt } from "crypto";

export function generateNumericOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length;

  return String(randomInt(min, max));
}

export function getEmailOtpExpiryDate() {
  const minutes = Number(process.env.EMAIL_OTP_EXPIRES_MINUTES || 1);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 1;

  return new Date(Date.now() + safeMinutes * 60 * 1000);
}
