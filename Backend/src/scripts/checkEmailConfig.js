import "dotenv/config";
import nodemailer from "nodemailer";

import { getEmailDeliveryConfig } from "../services/email.service.js";

const requiredKeys = ["EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS"];
const missingKeys = requiredKeys.filter((key) => !process.env[key]);

if (missingKeys.length > 0) {
  console.error(`Missing email config: ${missingKeys.join(", ")}`);
  process.exit(1);
}

const emailConfig = getEmailDeliveryConfig();

if (emailConfig.mode !== "smtp") {
  console.error(`Email config still has missing or placeholder values: ${emailConfig.issues.join(", ")}`);
  process.exit(1);
}

const timeoutMs = Number(process.env.SMTP_TIMEOUT_MS || 8000);
const smtpPassword = process.env.EMAIL_PASS.replace(/\s+/g, "");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: Number(process.env.EMAIL_PORT || 587) === 465,
  connectionTimeout: timeoutMs,
  greetingTimeout: timeoutMs,
  socketTimeout: timeoutMs,
  auth: {
    user: process.env.EMAIL_USER,
    pass: smtpPassword
  }
});

try {
  await transporter.verify();
  console.log("SMTP config is valid. LawFlow can send OTP emails.");
} catch (error) {
  console.error("SMTP config is invalid.");
  console.error(error.message);
  process.exit(1);
}
