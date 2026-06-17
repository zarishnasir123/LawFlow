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

// Synchronous variant — kept for any caller that still needs to surface SMTP
// success/failure inside the HTTP response. Registration no longer uses it
// because awaiting SMTP delayed the register button by the full send time and
// shrank the OTP countdown the frontend showed (see queueVerificationOtpEmail).
export async function deliverVerificationOtpEmail({ email, otp, firstName }) {
  const result = await sendVerificationOtpEmail({ email, otp, firstName });
  return toOtpEmailDeliveryStatus(result);
}

// Non-blocking OTP send. setImmediate fires the SMTP handshake in the same
// event-loop turn, before the HTTP response is flushed, so the email is in
// flight by the time the client receives the registration response — but the
// response no longer waits for SMTP to finish. This restores the full
// expires_at window the frontend shows on the OTP page.
export function queueVerificationOtpEmail({ email, otp, firstName }) {
  const emailConfig = getEmailDeliveryConfig();

  setImmediate(() => {
    sendVerificationOtpEmail({ email, otp, firstName })
      .then((result) => {
        if (result.mode === "smtp" && shouldLogEmailDebug()) {
          console.log("[EMAIL SENT]", {
            task: "verification-otp",
            messageId: result.messageId
          });
        }
      })
      .catch((error) => {
        console.error("[EMAIL QUEUE FAILED]", {
          task: "verification-otp",
          message: error.message
        });
      });
  });

  return {
    queued: true,
    emailSent: false,
    emailQueued: true,
    deliveryMode: emailConfig.mode,
    deliveryReason: emailConfig.issues.length > 0
      ? `SMTP is not configured. Missing or placeholder values: ${emailConfig.issues.join(", ")}`
      : undefined
  };
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
    : "Your LawFlow lawyer registration was returned — please resubmit";

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

export function sendLawyerSuspensionEmail({ email, firstName, reason }) {
  return send(email, "Your LawFlow lawyer account has been suspended", "lawyerSuspended", {
    firstName,
    reason
  });
}

export function queueLawyerSuspensionEmail({ email, firstName, reason }) {
  return queueEmailTask("lawyer-suspension", () => (
    sendLawyerSuspensionEmail({ email, firstName, reason })
  ));
}

export function sendRegistrarCredentialsEmail({ email, firstName, temporaryPassword }) {
  return send(email, "Your LawFlow registrar credentials", "registrarCredentials", {
    firstName,
    email,
    temporaryPassword,
    loginUrl: `${getFrontendUrl()}/login`
  });
}

function toCredentialsEmailDeliveryStatus(result) {
  return {
    emailSent: result.mode === "smtp",
    deliveryMode: result.mode,
    deliveryReason: result.reason
  };
}

// Synchronous delivery — used by the explicit "Resend credentials" admin
// action where per-call SMTP feedback matters. The create-registrar happy
// path should use queueRegistrarCredentialsEmail instead so the admin UI
// returns immediately.
export async function deliverRegistrarCredentialsEmail({ email, firstName, temporaryPassword }) {
  const result = await sendRegistrarCredentialsEmail({ email, firstName, temporaryPassword });
  return toCredentialsEmailDeliveryStatus(result);
}

// Non-blocking queued delivery. setImmediate starts the SMTP handshake in
// the same event-loop turn (before the HTTP response flushes), so the email
// is in flight by the time the admin sees the success toast — but the
// admin's Create button doesn't hang on the 5–8 second Gmail handshake.
// SMTP failures get logged via [EMAIL QUEUE FAILED] and the admin can fix
// + resend via the dedicated Resend Credentials action.
export function queueRegistrarCredentialsEmail({ email, firstName, temporaryPassword }) {
  const emailConfig = getEmailDeliveryConfig();

  setImmediate(() => {
    sendRegistrarCredentialsEmail({ email, firstName, temporaryPassword })
      .then((result) => {
        if (result.mode === "smtp" && shouldLogEmailDebug()) {
          console.log("[EMAIL SENT]", {
            task: "registrar-credentials",
            messageId: result.messageId
          });
        }
      })
      .catch((error) => {
        console.error("[EMAIL QUEUE FAILED]", {
          task: "registrar-credentials",
          message: error.message
        });
      });
  });

  return {
    emailSent: false,
    emailQueued: true,
    deliveryMode: emailConfig.mode,
    deliveryReason: emailConfig.issues.length > 0
      ? `SMTP is not configured. Missing or placeholder values: ${emailConfig.issues.join(", ")}`
      : undefined
  };
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

export function sendPasswordResetGoogleUserEmail({ email, firstName }) {
  return send(email, "Your LawFlow account uses Google Sign-In", "passwordResetGoogleUser", {
    firstName,
    loginUrl: `${getFrontendUrl()}/login`
  });
}

export function queuePasswordResetGoogleUserEmail({ email, firstName }) {
  return queueEmailTask("password-reset-google-user", () => (
    sendPasswordResetGoogleUserEmail({ email, firstName })
  ));
}

// Signature-request notification: sent when a lawyer creates a batch.
// Email is a notification only — signing happens in-app, so the CTA
// just routes to the login page. signerRole is 'client' or 'lawyer';
// signerRoleLabel becomes the natural-language fragment in the body
// copy ("as the client" / "as the advocate").
export function sendSignatureRequestEmail({
  email,
  firstName,
  caseTitle,
  requestingLawyerName,
  pageCount,
  signerRole,
  expiresAt,
}) {
  const safePageCount = Number.isFinite(pageCount) && pageCount > 0 ? pageCount : 1;
  const expiryDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const expiresLabel = Number.isFinite(expiryDate.getTime())
    ? expiryDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "the request expiry date";
  const signerRoleLabel = signerRole === "lawyer" ? "as the advocate" : "as the client";

  return send(email, "A document is waiting for your signature on LawFlow", "signatureRequest", {
    firstName: firstName || "there",
    caseTitle,
    requestingLawyerName,
    pageCount: safePageCount,
    pageSuffix: safePageCount === 1 ? "" : "s",
    signerRoleLabel,
    expiresLabel,
    loginUrl: `${getFrontendUrl()}/login`,
  });
}

export function queueSignatureRequestEmail({
  email,
  firstName,
  caseTitle,
  requestingLawyerName,
  pageCount,
  signerRole,
  expiresAt,
}) {
  return queueEmailTask("signature-request", () =>
    sendSignatureRequestEmail({
      email,
      firstName,
      caseTitle,
      requestingLawyerName,
      pageCount,
      signerRole,
      expiresAt,
    })
  );
}

// Signer-side cancellation notification: fired when the case-owning
// lawyer cancels an existing pending signature_requests row. Mirrors
// the signatureRequest pair so the recipient knows the previously-
// sent link is no longer valid — no action needed on their side; a
// fresh request will follow if the lawyer needs them to sign again.
// Skip-self (lawyer cancelling their own self-assigned row) is the
// caller's responsibility, not this helper's.
export function sendSignatureRequestCancelledEmail({
  email,
  firstName,
  caseTitle,
  requestingLawyerName,
  pageCount,
  signerRole,
}) {
  const safePageCount = Number.isFinite(pageCount) && pageCount > 0 ? pageCount : 1;
  const signerRoleLabel = signerRole === "lawyer" ? "as the advocate" : "as the client";

  return send(email, "A signature request was withdrawn on LawFlow", "signatureRequestCancelled", {
    firstName: firstName || "there",
    caseTitle,
    requestingLawyerName,
    pageCount: safePageCount,
    pageSuffix: safePageCount === 1 ? "" : "s",
    signerRoleLabel,
    loginUrl: `${getFrontendUrl()}/login`,
  });
}

export function queueSignatureRequestCancelledEmail({
  email,
  firstName,
  caseTitle,
  requestingLawyerName,
  pageCount,
  signerRole,
}) {
  return queueEmailTask("signature-request-cancelled", () =>
    sendSignatureRequestCancelledEmail({
      email,
      firstName,
      caseTitle,
      requestingLawyerName,
      pageCount,
      signerRole,
    })
  );
}

// Signer-completion notification: fired when a signature_requests row
// transitions to status='signed'. Goes to the case's owning lawyer so
// they know the case moved one step closer to submittable, with a CTA
// that links straight back to the editor for that case. The skip-self
// rule (lawyer is also the signer → don't email) is enforced by the
// caller, not here, so this helper stays single-purpose.
export function sendSignatureCompletionEmail({
  lawyerEmail,
  lawyerFirstName,
  signerName,
  signerRole,
  caseId,
  caseTitle,
  pageIndices,
}) {
  const indices = Array.isArray(pageIndices) ? pageIndices : [];
  const pageNumbers = indices.length > 0
    ? indices.map((i) => i + 1)
    : [];
  const pageList = pageNumbers.length > 0
    ? pageNumbers.join(", ")
    : "the requested page";
  const pageSuffix = pageNumbers.length === 1 ? "" : "s";
  // Short label for the "Signed by … · <label>" line in the body.
  // Full natural-language fragment for the inline copy.
  const signerRoleLabelShort = signerRole === "lawyer" ? "Lawyer" : "Client";
  const signerRoleLabel =
    signerRole === "lawyer" ? "as the advocate" : "as the client";
  const caseEditorUrl = `${getFrontendUrl()}/lawyer-case-editor/${caseId}`;

  const subject = `${signerName} signed page${pageSuffix} ${pageList} — ${caseTitle}`;

  return send(lawyerEmail, subject, "signatureCompleted", {
    lawyerFirstName: lawyerFirstName || "there",
    signerName,
    signerRoleLabel,
    signerRoleLabelShort,
    caseTitle,
    pageList,
    pageSuffix,
    caseEditorUrl,
  });
}

export function queueSignatureCompletionEmail(params) {
  return queueEmailTask("signature-completion", () =>
    sendSignatureCompletionEmail(params)
  );
}

// Account deactivation confirmation: fired when a user self-
// deactivates via DELETE /auth/me. Tells them when it happened,
// when the 30-day recovery window ends, and how to recover the
// account if they didn't mean to deactivate.
export function sendAccountDeactivatedEmail({
  email,
  firstName,
  deactivatedAt,
  recoveryDeadline,
}) {
  // Both timestamps are ISO strings / Date objects on the way in.
  // We render them as "Month dd, yyyy" so the email reads cleanly
  // across locales; if either is missing we substitute a sensible
  // placeholder rather than letting the template render "Invalid
  // Date".
  const formatLabel = (value, fallback) => {
    if (!value) return fallback;
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return fallback;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };
  const deactivatedAtLabel = formatLabel(deactivatedAt, "today");
  const recoveryDeadlineLabel = formatLabel(
    recoveryDeadline,
    "30 days from now"
  );

  return send(email, "Your LawFlow account has been deactivated", "accountDeactivated", {
    firstName: firstName || "there",
    deactivatedAtLabel,
    recoveryDeadlineLabel,
    loginUrl: `${getFrontendUrl()}/login`,
  });
}

export function queueAccountDeactivatedEmail(params) {
  return queueEmailTask("account-deactivated", () =>
    sendAccountDeactivatedEmail(params)
  );
}

// --- Overdue installment reminders (sent by the scheduler, to client + lawyer) ---

export function sendInstallmentOverdueClientEmail({
  email,
  firstName,
  caseTitle,
  installmentLabel,
  amount,
  dueDateLabel,
  daysOverdue,
  paymentsUrl,
}) {
  const days = Number.isFinite(daysOverdue) ? Math.max(0, daysOverdue) : 0;
  return send(email, `Payment overdue: ${installmentLabel} for "${caseTitle}"`, "installmentOverdueClient", {
    firstName: firstName || "there",
    caseTitle,
    installmentLabel,
    amount: Number(amount || 0).toLocaleString(),
    dueDateLabel,
    daysOverdue: days,
    daysOverdueSuffix: days === 1 ? "" : "s",
    paymentsUrl: paymentsUrl || `${getFrontendUrl()}/login`,
  });
}

export function queueInstallmentOverdueClientEmail(params) {
  return queueEmailTask("installment-overdue-client", () =>
    sendInstallmentOverdueClientEmail(params)
  );
}

export function sendInstallmentOverdueLawyerEmail({
  email,
  firstName,
  clientName,
  caseTitle,
  installmentLabel,
  amount,
  dueDateLabel,
  daysOverdue,
  paymentsUrl,
}) {
  const days = Number.isFinite(daysOverdue) ? Math.max(0, daysOverdue) : 0;
  return send(email, `Client payment overdue on "${caseTitle}"`, "installmentOverdueLawyer", {
    firstName: firstName || "Counsel",
    clientName: clientName || "Your client",
    caseTitle,
    installmentLabel,
    amount: Number(amount || 0).toLocaleString(),
    dueDateLabel,
    daysOverdue: days,
    daysOverdueSuffix: days === 1 ? "" : "s",
    paymentsUrl: paymentsUrl || `${getFrontendUrl()}/login`,
  });
}

export function queueInstallmentOverdueLawyerEmail(params) {
  return queueEmailTask("installment-overdue-lawyer", () =>
    sendInstallmentOverdueLawyerEmail(params)
  );
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
