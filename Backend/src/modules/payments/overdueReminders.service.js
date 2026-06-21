import { pool } from "../../config/db.js";
import { markOverdueInstallments } from "./agreements.service.js";
import { createNotification } from "../notifications/notifications.service.js";
import {
  queueInstallmentOverdueClientEmail,
  queueInstallmentOverdueLawyerEmail,
} from "../../services/email.service.js";

// How many days between repeated reminders for the SAME overdue installment.
const DEFAULT_CADENCE_DAYS = 3;

function frontendBaseUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
}

function installmentLabel(number) {
  return Number(number) === 0 ? "Service Charge" : `Installment ${number}`;
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "its due date";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysOverdue(value) {
  const due = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(due.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today - due) / (1000 * 60 * 60 * 24)));
}

// Best-effort in-app notification — never lets a notification failure abort the
// reminder run for an installment.
async function safeNotify(payload) {
  try {
    await createNotification(payload);
  } catch (error) {
    console.error(
      "[overdue-reminders] notification failed:",
      error?.message || error
    );
  }
}

/**
 * Finds overdue, unpaid installments and reminds BOTH the client and the lawyer
 * (email + in-app notification), then stamps the installment so reminders are
 * spaced `cadenceDays` apart — i.e. recurring until the installment is paid.
 *
 * Safe to run repeatedly (idempotent within the cadence window): the
 * `last_overdue_reminder_at` stamp prevents duplicate emails. Each installment
 * is handled best-effort so one failure never stops the rest.
 *
 * Returns { checked, remindersSent }.
 */
export async function sendOverdueReminders({
  cadenceDays = DEFAULT_CADENCE_DAYS,
} = {}) {
  // Make statuses current first (pending -> overdue for any past-due rows).
  await markOverdueInstallments(null);

  const { rows } = await pool.query(
    `SELECT
       i.id              AS installment_id,
       i.installment_number,
       i.amount,
       i.due_date,
       a.case_id,
       cl.id             AS client_id,
       cl.first_name     AS client_first,
       cl.last_name      AS client_last,
       cl.email          AS client_email,
       lw.id             AS lawyer_id,
       lw.first_name     AS lawyer_first,
       lw.last_name      AS lawyer_last,
       lw.email          AS lawyer_email,
       c.title           AS case_title
     FROM installments i
     JOIN agreements a ON a.id = i.agreement_id
     JOIN cases c      ON c.id = a.case_id
     JOIN users cl     ON cl.id = a.client_user_id
     JOIN users lw     ON lw.id = a.lawyer_user_id
     WHERE i.status = 'overdue'
       AND (
         i.last_overdue_reminder_at IS NULL
         OR i.last_overdue_reminder_at < NOW() - ($1 * INTERVAL '1 day')
       )
     ORDER BY i.due_date ASC`,
    [cadenceDays]
  );

  let remindersSent = 0;

  for (const row of rows) {
    const label = installmentLabel(row.installment_number);
    const amount = Number(row.amount) || 0;
    const dueLabel = formatDate(row.due_date);
    const late = daysOverdue(row.due_date);
    const clientName =
      `${row.client_first || ""} ${row.client_last || ""}`.trim() || "there";
    const lawyerName =
      `${row.lawyer_first || ""} ${row.lawyer_last || ""}`.trim() || "Counsel";
    const caseTitle = row.case_title || "your case";
    const amountLabel = amount.toLocaleString();

    // Emails are fire-and-forget (queueEmailTask never throws synchronously).
    if (row.client_email) {
      queueInstallmentOverdueClientEmail({
        email: row.client_email,
        firstName: row.client_first || "there",
        caseTitle,
        installmentLabel: label,
        amount,
        dueDateLabel: dueLabel,
        daysOverdue: late,
        paymentsUrl: `${frontendBaseUrl()}/client-payments/${row.case_id}`,
        userId: row.client_id,
      });
    }
    if (row.lawyer_email) {
      queueInstallmentOverdueLawyerEmail({
        email: row.lawyer_email,
        firstName: row.lawyer_first || "Counsel",
        clientName,
        caseTitle,
        installmentLabel: label,
        amount,
        dueDateLabel: dueLabel,
        daysOverdue: late,
        paymentsUrl: `${frontendBaseUrl()}/lawyer-case-payments/${row.case_id}`,
        userId: row.lawyer_id,
      });
    }

    // In-app notifications (best-effort) for both parties.
    await safeNotify({
      userId: row.client_id,
      type: "payment_overdue",
      title: "Payment overdue",
      message: `${label} of PKR ${amountLabel} for "${caseTitle}" was due ${dueLabel}. Please pay to avoid further delay.`,
      caseId: row.case_id,
    });
    await safeNotify({
      userId: row.lawyer_id,
      type: "payment_overdue",
      title: "Client payment overdue",
      message: `${clientName}'s ${label.toLowerCase()} of PKR ${amountLabel} for "${caseTitle}" was due ${dueLabel}.`,
      caseId: row.case_id,
    });

    // Stamp so the next reminder for this installment is cadenceDays away.
    try {
      await pool.query(
        `UPDATE installments SET last_overdue_reminder_at = NOW() WHERE id = $1`,
        [row.installment_id]
      );
      remindersSent += 1;
    } catch (error) {
      console.error(
        `[overdue-reminders] stamp failed for installment ${row.installment_id}:`,
        error?.message || error
      );
    }
  }

  return { checked: rows.length, remindersSent };
}
