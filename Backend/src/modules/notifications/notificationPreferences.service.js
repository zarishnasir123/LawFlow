import { pool } from "../../config/db.js";

// The notification categories a user can mute EMAILS for. These map to the
// in-app notification categories and to the email senders' `category` argument.
// (SMS + "system updates" are intentionally not here — LawFlow has no SMS and
// no system-maintenance emails.)
export const EMAIL_CATEGORIES = [
  "case",
  "hearing",
  "message",
  "document",
  "payment",
];

// Opted-in by default: a user with no saved row receives every email.
const DEFAULTS = {
  emailEnabled: true,
  case: true,
  hearing: true,
  message: true,
  document: true,
  payment: true,
};

function mapRow(row) {
  if (!row) return { ...DEFAULTS };
  return {
    emailEnabled: row.email_enabled,
    case: row.email_case,
    hearing: row.email_hearing,
    message: row.email_message,
    document: row.email_document,
    payment: row.email_payment,
  };
}

// Keep only the known boolean keys from a caller-supplied patch.
function sanitizePatch(patch) {
  const out = {};
  if (typeof patch?.emailEnabled === "boolean") out.emailEnabled = patch.emailEnabled;
  for (const c of EMAIL_CATEGORIES) {
    if (typeof patch?.[c] === "boolean") out[c] = patch[c];
  }
  return out;
}

// Current preferences for a user (defaults when no row exists yet).
export async function getNotificationPreferences(userId) {
  const result = await pool.query(
    "SELECT * FROM notification_preferences WHERE user_id = $1",
    [userId]
  );
  return mapRow(result.rows[0]);
}

// Upsert the user's preferences from a partial patch; returns the merged result.
export async function updateNotificationPreferences(userId, patch) {
  const current = await getNotificationPreferences(userId);
  const next = { ...current, ...sanitizePatch(patch) };

  await pool.query(
    `INSERT INTO notification_preferences
       (user_id, email_enabled, email_case, email_hearing, email_message, email_document, email_payment, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       email_enabled  = EXCLUDED.email_enabled,
       email_case     = EXCLUDED.email_case,
       email_hearing  = EXCLUDED.email_hearing,
       email_message  = EXCLUDED.email_message,
       email_document = EXCLUDED.email_document,
       email_payment  = EXCLUDED.email_payment,
       updated_at     = NOW()`,
    [
      userId,
      next.emailEnabled,
      next.case,
      next.hearing,
      next.message,
      next.document,
      next.payment,
    ]
  );

  return next;
}

// Gate used right before queueing a NON-essential email. Returns false only
// when the user has explicitly muted email overall or that category. Best-
// effort: on any error (or no userId) it returns true, so a transient DB blip
// never silently swallows an email. The in-app bell is never affected by this.
export async function isEmailEnabled(userId, category) {
  if (!userId) return true;
  try {
    const prefs = await getNotificationPreferences(userId);
    if (!prefs.emailEnabled) return false;
    if (EMAIL_CATEGORIES.includes(category)) {
      return prefs[category] !== false;
    }
    return true;
  } catch {
    return true;
  }
}
