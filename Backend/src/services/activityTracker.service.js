import { pool } from "../config/db.js";

// =====================================================================
// Daily active-user ledger.
//
// Records "this user was active today" at most once per user per day into the
// user_activity table (PRIMARY KEY (user_id, activity_date)). Called best-effort
// from the authenticate middleware on every authenticated request, so it must be
// cheap and must NEVER block or break a request.
//
// Throttling: we keep an in-process Set of user-ids already written for the
// current local day. The first request from a user on a given day does one
// INSERT ... ON CONFLICT DO NOTHING; subsequent requests that day are no-ops
// (no DB round-trip). At midnight (detected lazily on the next request) the Set
// is replaced, so it never grows beyond "distinct active users today" and needs
// no timers. With multiple processes each has its own Set; the ON CONFLICT makes
// the redundant cross-process writes harmless.
// =====================================================================

let seenUserIds = new Set();
let seenDateKey = localDateKey();

// Server-local YYYY-MM-DD — matches Postgres CURRENT_DATE on the same host, so
// the throttle's notion of "today" lines up with what we INSERT.
function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function recordActivity(userId) {
  if (!userId) return;

  const today = localDateKey();
  if (today !== seenDateKey) {
    // Day rolled over — forget yesterday's ids so today gets recorded.
    seenUserIds = new Set();
    seenDateKey = today;
  }

  if (seenUserIds.has(userId)) return;
  // Add BEFORE the await so two concurrent requests from the same user don't
  // both fire an INSERT.
  seenUserIds.add(userId);

  pool
    .query(
      `INSERT INTO user_activity (user_id, activity_date)
       VALUES ($1, CURRENT_DATE)
       ON CONFLICT (user_id, activity_date) DO NOTHING`,
      [userId]
    )
    .catch((err) => {
      // Write failed (e.g. transient DB blip) — drop the id so a later request
      // retries. Never throw; this is a best-effort metric.
      seenUserIds.delete(userId);
      console.error("[activity] user_activity write failed:", err?.message || err);
    });
}
