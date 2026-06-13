import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";

// =====================================================================
// In-app notifications.
//
// Every read/write in this module is scoped to a single recipient's
// user_id (passed in as `userId`, always sourced from req.user.sub by the
// controller). A user can therefore only ever see / mark their OWN rows —
// the WHERE user_id = $n guard is on every statement, so there is no way to
// read or mutate another user's notification even by guessing an id.
//
// All SQL is parameterised.
// =====================================================================

// Number of notifications returned by the list endpoint. The bell/list UI
// only ever shows the most recent slice; the unread COUNT is computed
// separately so a user with >50 unread still sees an accurate badge.
const LIST_LIMIT = 50;

// Map one notifications row to the camelCase Notification JSON shape the
// frontend consumes. Keep this in one place so list + markOneRead return
// an identical shape.
function mapNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    caseId: row.case_id,
    isRead: row.is_read,
    createdAt: row.created_at
  };
}

// Reusable INSERT helper. Other modules import this to fire a notification
// for a user (e.g. registrarReview on approve/return). Returns the created
// row mapped to the Notification shape. Parameterised; `caseId` is optional
// and stored NULL when omitted.
//
// Callers that treat notification creation as best-effort (it must never
// break their primary flow) should wrap this in try/catch themselves — this
// helper does not swallow errors, so a programming mistake (e.g. a missing
// required field) still surfaces in tests.
export async function createNotification({
  userId,
  type,
  title,
  message,
  caseId = null
}) {
  const result = await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, case_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, type, title, message, case_id, is_read, created_at`,
    [userId, type, title, message, caseId]
  );

  return mapNotification(result.rows[0]);
}

// GET list payload: the caller's most recent notifications (newest first,
// capped at LIST_LIMIT) plus the total unread count across ALL their rows
// (not just the returned slice) so the bell badge stays accurate.
export async function listNotificationsForUser({ userId }) {
  const listResult = await pool.query(
    `SELECT id, type, title, message, case_id, is_read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, LIST_LIMIT]
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) AS unread_count
     FROM notifications
     WHERE user_id = $1
       AND is_read = FALSE`,
    [userId]
  );

  return {
    notifications: listResult.rows.map(mapNotification),
    unreadCount: Number(countResult.rows[0].unread_count)
  };
}

// Mark a single notification read. The user_id guard is part of the WHERE so
// a caller can only ever flip their own row; a missing/foreign id yields
// rowCount 0 -> 404 (we don't distinguish "not found" from "not yours" so we
// never leak the existence of another user's notification). Idempotent: a
// row already read is still returned with is_read = true.
export async function markNotificationRead({ userId, notificationId }) {
  const result = await pool.query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE id = $1
       AND user_id = $2
     RETURNING id, type, title, message, case_id, is_read, created_at`,
    [notificationId, userId]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "Notification not found");
  }

  return mapNotification(result.rows[0]);
}

// Mark every unread notification for the caller read in one statement.
// Returns how many rows were actually flipped (already-read rows are
// excluded by the is_read = FALSE filter) so the UI can reconcile its badge.
export async function markAllNotificationsRead({ userId }) {
  const result = await pool.query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE user_id = $1
       AND is_read = FALSE`,
    [userId]
  );

  return { updated: result.rowCount };
}
