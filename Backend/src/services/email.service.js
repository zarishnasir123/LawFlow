import nodemailer from "nodemailer";

const brandName = "LawFlow";
const brandTagline = "Smart Case Filing System";
const supportLine = "This is an automated LawFlow security email. Do not share OTPs or passwords with anyone.";
const defaultBrandColor = "#01411c";
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

function createTransporter() {
  const timeoutMs = Number(process.env.SMTP_TIMEOUT_MS || 8000);

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: Number(process.env.EMAIL_PORT || 587) === 465,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    auth: {
      user: process.env.EMAIL_USER,
      pass: getSmtpPassword()
    }
  });
}

export async function sendEmail({ to, subject, text, html }) {
  const emailConfig = getEmailDeliveryConfig();

  if (emailConfig.issues.length > 0) {
    console.log("[DEV EMAIL]", {
      reason: `SMTP is not configured. Missing or placeholder values: ${emailConfig.issues.join(", ")}`,
      to,
      subject,
      text
    });
    return {
      mode: "console",
      reason: `SMTP is not configured. Missing or placeholder values: ${emailConfig.issues.join(", ")}`
    };
  }

  const transporter = createTransporter();

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createLogoMarkup() {
  const logoUrl = process.env.EMAIL_LOGO_URL?.trim();

  if (logoUrl) {
    return `
      <img
        src="${escapeHtml(logoUrl)}"
        width="64"
        height="64"
        alt="${brandName} logo"
        style="display:block;width:64px;height:64px;border-radius:18px;object-fit:cover;margin:0 auto 12px;"
      />
    `;
  }

  return `
    <div style="width:64px;height:64px;border-radius:18px;background:#ffffff;color:${defaultBrandColor};font-size:22px;font-weight:800;line-height:64px;text-align:center;margin:0 auto 12px;">
      LF
    </div>
  `;
}

function createEmailLayout({ title, previewText, bodyHtml, footerText = supportLine }) {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
      </head>
      <body style="margin:0;background:#eef8f2;font-family:Arial,Helvetica,sans-serif;color:#172033;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
          ${escapeHtml(previewText)}
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef8f2;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #cfe9d9;border-radius:18px;overflow:hidden;box-shadow:0 18px 45px rgba(1,65,28,0.12);">
                <tr>
                  <td style="background:${defaultBrandColor};padding:30px 28px;text-align:center;">
                    ${createLogoMarkup()}
                    <div style="color:#ffffff;font-size:26px;font-weight:800;letter-spacing:0;">${brandName}</div>
                    <div style="color:#d7f3df;font-size:13px;margin-top:5px;">${brandTagline}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:34px 30px;">
                    ${bodyHtml}
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8fbf9;border-top:1px solid #e2f0e8;padding:20px 30px;color:#5f6f66;font-size:12px;line-height:1.7;">
                    ${escapeHtml(footerText)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function createOtpDigitsMarkup(otp) {
  return String(otp)
    .split("")
    .map((digit) => `
      <td style="padding:0 4px;">
        <div style="width:44px;height:52px;border:1px solid #b8dec7;border-radius:10px;background:#ffffff;color:${defaultBrandColor};font-size:28px;font-weight:800;line-height:52px;text-align:center;">
          ${escapeHtml(digit)}
        </div>
      </td>
    `)
    .join("");
}

export function sendVerificationOtpEmail({ email, otp, firstName }) {
  const configuredExpiryMinutes = Number(process.env.EMAIL_OTP_EXPIRES_MINUTES || 1);
  const expiryMinutes = Number.isFinite(configuredExpiryMinutes) && configuredExpiryMinutes > 0
    ? configuredExpiryMinutes
    : 1;
  const expiryLabel = `${expiryMinutes} ${expiryMinutes === 1 ? "minute" : "minutes"}`;
  const subject = "Your LawFlow verification code";
  const safeFirstName = escapeHtml(firstName);
  const text = [
    `Hello ${firstName},`,
    "",
    `Your LawFlow verification code is: ${otp}`,
    `This code expires in ${expiryLabel}.`,
    "",
    "Enter this code in LawFlow to verify your email address.",
    "If you did not create a LawFlow account, ignore this email."
  ].join("\n");

  const html = createEmailLayout({
    title: "Verify your LawFlow email",
    previewText: `Your LawFlow verification code is ${otp}.`,
    bodyHtml: `
      <h1 style="margin:0 0 12px;color:${defaultBrandColor};font-size:24px;line-height:1.3;">Verify your email address</h1>
      <p style="margin:0 0 18px;color:#344054;font-size:15px;line-height:1.7;">Hello ${safeFirstName},</p>
      <p style="margin:0 0 22px;color:#344054;font-size:15px;line-height:1.7;">
        Use this one-time password to verify your email and complete your LawFlow account setup.
      </p>
      <div style="margin:24px 0;padding:22px 16px;background:#ecf8f0;border:1px solid #ccebd8;border-radius:14px;text-align:center;">
        <div style="font-size:13px;color:#496154;margin-bottom:14px;text-transform:uppercase;letter-spacing:1px;">Verification Code</div>
        <table role="presentation" cellspacing="0" cellpadding="0" align="center">
          <tr>
            ${createOtpDigitsMarkup(otp)}
          </tr>
        </table>
      </div>
      <p style="margin:0 0 12px;color:#344054;font-size:14px;line-height:1.7;">
        This code expires in <strong>${expiryLabel}</strong>.
      </p>
      <p style="margin:0;color:#667085;font-size:13px;line-height:1.7;">
        If you did not request this code, you can safely ignore this email.
      </p>
    `
  });

  return sendEmail({ to: email, subject, text, html });
}

export function queueVerificationOtpEmail({ email, otp, firstName }) {
  return queueEmailTask("verification-otp", () => (
    sendVerificationOtpEmail({ email, otp, firstName })
  ));
}

export function sendWelcomeEmail({ email, firstName }) {
  const subject = "Your LawFlow account is ready";
  const safeFirstName = escapeHtml(firstName);
  const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/login`;
  const text = [
    `Hello ${firstName},`,
    "",
    "Congratulations. Your LawFlow account has been created and your email is verified.",
    "You can now log in and start using your LawFlow client dashboard.",
    "",
    "Thank you for choosing LawFlow."
  ].join("\n");

  const html = createEmailLayout({
    title: "Welcome to LawFlow",
    previewText: "Your LawFlow account is ready.",
    bodyHtml: `
      <h1 style="margin:0 0 12px;color:${defaultBrandColor};font-size:24px;line-height:1.3;">Welcome to LawFlow</h1>
      <p style="margin:0 0 18px;color:#344054;font-size:15px;line-height:1.7;">Hello ${safeFirstName},</p>
      <p style="margin:0 0 18px;color:#344054;font-size:15px;line-height:1.7;">
        Congratulations. Your LawFlow account has been created successfully and your email is verified.
      </p>
      <div style="margin:22px 0;padding:20px;background:#ecf8f0;border:1px solid #ccebd8;border-radius:14px;">
        <p style="margin:0;color:${defaultBrandColor};font-size:15px;line-height:1.7;font-weight:700;">
          Your client account is ready.
        </p>
        <p style="margin:8px 0 0;color:#344054;font-size:14px;line-height:1.7;">
          You can now log in and continue with LawFlow services.
        </p>
      </div>
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
        <tr>
          <td style="background:${defaultBrandColor};border-radius:10px;">
            <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:13px 22px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
              Continue to Login
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;color:#667085;font-size:13px;line-height:1.7;">
        Keep your login details private and do not share verification codes with anyone.
      </p>
    `
  });

  return sendEmail({ to: email, subject, text, html });
}

export function queueWelcomeEmail({ email, firstName }) {
  return queueEmailTask("welcome", () => sendWelcomeEmail({ email, firstName }));
}
