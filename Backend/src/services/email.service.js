import nodemailer from "nodemailer";

import { preloadEmailTemplates, renderEmail } from "./emailTemplates/index.js";

const placeholderValues = new Set([
  "your_email@gmail.com",
  "your_sender_email@gmail.com",
  "your_actual_gmail@gmail.com",
  "your_lawflow_sender_gmail@gmail.com",
  "lawflow.sender@gmail.com",
  "your_google_app_password",
  "google_app_password",
  "your_sender_google_app_password",
  "PUT_LAWFLOW_SENDER_GMAIL_HERE",
  "PUT_GOOGLE_APP_PASSWORD_HERE",
  "PUT_16_DIGIT_GOOGLE_APP_PASSWORD_HERE",
  "PUT_NEW_GOOGLE_APP_PASSWORD_HERE",
  "PUT_YOUR_16_DIGIT_GOOGLE_APP_PASSWORD_HERE",
  "abcdefghijklmnop"
]);

function getSmtpPassword() {
  return process.env.EMAIL_PASS?.replace(/\s+/g, "") || "";
}

export function getEmailDeliveryConfig() {
  const requiredValues = [
    ["EMAIL_HOST", process.env.EMAIL_HOST],
    ["EMAIL_USER", process.env.EMAIL_USER],
    ["EMAIL_PASS", getSmtpPassword()]
  ];

  const issues = requiredValues
    .filter(([, value]) => !value || placeholderValues.has(value.trim()))
    .map(([key]) => key);

  return {
    mode: issues.length === 0 ? "smtp" : "console",
    issues
  };
}

function shouldLogEmailDebug() {
  return process.env.EMAIL_DEBUG === "true";
}

let sharedTransporter = null;

function createTransporter() {
  const timeoutMs = Number(process.env.SMTP_TIMEOUT_MS || 8000);
  const port = Number(process.env.EMAIL_PORT || 587);

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: port === 465,
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    auth: {
      user: process.env.EMAIL_USER,
      pass: getSmtpPassword()
    }
  });
}

function getSharedTransporter() {
  if (!sharedTransporter) {
    sharedTransporter = createTransporter();
  }

  return sharedTransporter;
}

export async function sendEmail({ to, subject, text, html }) {
  const emailConfig = getEmailDeliveryConfig();

  if (emailConfig.issues.length > 0) {
    console.log("[DEV EMAIL]", {
      reason: `SMTP is not configured. Missing or placeholder values: ${emailConfig.issues.join(", ")}`,
      to,
      subject
    });
    return {
      mode: "console",
      reason: `SMTP is not configured. Missing or placeholder values: ${emailConfig.issues.join(", ")}`
    };
  }

  const transporter = getSharedTransporter();

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      text,
      html
    });

    return { mode: "smtp", messageId: info.messageId };
  } catch (error) {
    console.error("[SMTP EMAIL FAILED]", {
      to,
      subject,
      message: error.message,
      code: error.code,
      command: error.command
    });

    return {
      mode: "failed",
      reason: "SMTP delivery failed. Check EMAIL_USER and EMAIL_PASS in Backend/.env."
    };
  }
}

function getEmailQueueStatus() {
  const emailConfig = getEmailDeliveryConfig();

  return {
    queued: true,
    mode: emailConfig.mode,
    reason: emailConfig.issues.length > 0
      ? `SMTP is not configured. Missing or placeholder values: ${emailConfig.issues.join(", ")}`
      : undefined
  };
}

function queueEmailTask(taskName, sendTask) {
  const status = getEmailQueueStatus();

  setImmediate(() => {
    sendTask()
      .then((result) => {
        if (result.mode === "smtp" && shouldLogEmailDebug()) {
          console.log("[EMAIL SENT]", {
            task: taskName,
            messageId: result.messageId
          });
        }
      })
      .catch((error) => {
        console.error("[EMAIL QUEUE FAILED]", {
          task: taskName,
          message: error.message
        });
      });
  });

  return status;
}

function getFrontendUrl() {
  return process.env.FRONTEND_URL || "http://localhost:5173";
}

function send(to, subject, templateName, vars) {
  const html = renderEmail(templateName, vars);
  return sendEmail({ to, subject, html });
}

export function sendVerificationOtpEmail({ email, otp, firstName }) {
  const configured = Number(process.env.EMAIL_OTP_EXPIRES_MINUTES || 1);
  const expiryMinutes = Number.isFinite(configured) && configured > 0 ? configured : 1;
  const expiryLabel = `${expiryMinutes} ${expiryMinutes === 1 ? "minute" : "minutes"}`;

  return send(email, "Your LawFlow verification code", "verificationOtp", {
    firstName,
    otp,
    digits: String(otp).split(""),
    expiryLabel
  });
}

function toOtpEmailDeliveryStatus(result) {
  return {
    queued: false,
    emailSent: result.mode === "smtp",
    emailQueued: false,
    deliveryMode: result.mode,
    deliveryReason: result.reason
  };
}

// OTP is time-sensitive: send during the request instead of deferring with
// setImmediate so the SMTP handshake starts before the HTTP response finishes.
export async function deliverVerificationOtpEmail({ email, otp, firstName }) {
  const result = await sendVerificationOtpEmail({ email, otp, firstName });
  return toOtpEmailDeliveryStatus(result);
}

export function queueVerificationOtpEmail({ email, otp, firstName }) {
  return deliverVerificationOtpEmail({ email, otp, firstName });
}

export function sendWelcomeEmail({ email, firstName }) {
  return send(email, "Your LawFlow account is ready", "welcome", {
    firstName,
    loginUrl: `${getFrontendUrl()}/login`
  });
}

export function queueWelcomeEmail({ email, firstName }) {
  return queueEmailTask("welcome", () => sendWelcomeEmail({ email, firstName }));
}

export function sendLawyerPendingReviewEmail({ email, firstName }) {
  return send(email, "Your LawFlow lawyer registration is under review", "lawyerPendingReview", {
    firstName
  });
}

export function queueLawyerPendingReviewEmail({ email, firstName }) {
  return queueEmailTask("lawyer-pending-review", () => (
    sendLawyerPendingReviewEmail({ email, firstName })
  ));
}

export function sendLawyerRegistrationDecisionEmail({ email, firstName, status, remarks }) {
  const approved = status === "approved";
  const subject = approved
    ? "Your LawFlow lawyer account is approved"
    : "Your LawFlow lawyer registration needs updates";

  if (approved) {
    return send(email, subject, "lawyerApproved", {
      firstName,
      loginUrl: `${getFrontendUrl()}/login`
    });
  }

  return send(email, subject, "lawyerRejected", {
    firstName,
    remarks: remarks || "Please review your submitted documents and re-upload the required files.",
    registerUrl: `${getFrontendUrl()}/register`
  });
}

export function queueLawyerRegistrationDecisionEmail({ email, firstName, status, remarks }) {
  return queueEmailTask("lawyer-registration-decision", () => (
    sendLawyerRegistrationDecisionEmail({ email, firstName, status, remarks })
  ));
}

export function sendPasswordResetEmail({ email, firstName, resetUrl }) {
  return send(email, "Reset your LawFlow password", "passwordReset", {
    firstName,
    resetUrl,
    expiryLabel: "15 minutes"
  });
}

export function queuePasswordResetEmail({ email, firstName, resetUrl }) {
  return queueEmailTask("password-reset", () => (
    sendPasswordResetEmail({ email, firstName, resetUrl })
  ));
}

export async function warmEmailTransport() {
  preloadEmailTemplates(["verificationOtp"]);

  const emailConfig = getEmailDeliveryConfig();
  if (emailConfig.mode !== "smtp") {
    return { warmed: false, reason: emailConfig.issues.join(", ") };
  }

  try {
    await getSharedTransporter().verify();
    return { warmed: true };
  } catch (error) {
    console.warn("[EMAIL WARMUP FAILED]", error.message);
    return { warmed: false, reason: error.message };
  }
}
