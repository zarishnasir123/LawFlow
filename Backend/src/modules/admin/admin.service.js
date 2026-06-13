import { pool } from "../../config/db.js";

// =====================================================================
// Admin dashboard stats.
//
// One small COUNT query per metric (no joins-of-convenience that would
// couple unrelated counts into a single brittle query). Every query is
// parameterised even where the parameter is a constant string, so the
// shapes stay uniform and SQL injection is structurally impossible.
//
// Metrics that have NO reliable source column return `null` rather than a
// fabricated number — the frontend hides / replaces those sub-lines:
//
//   * registrarsOnline — there is no presence / session-heartbeat tracking
//     anywhere in the schema (auth_sessions stores refresh-token hashes and
//     expiry, not live presence), so "online right now" cannot be derived.
//     Always null.
//
// Everything else maps onto a real column:
//   pendingVerifications       lawyer_profiles.verification_status = 'pending'
//   pendingVerificationsToday  ^ AND lawyer_profiles.created_at::date = today
//   activeRegistrars           users(role=registrar).account_status = 'active'
//   totalUsers                 COUNT(users)
//   newUsersThisWeek           users.created_at >= NOW() - 7 days
//   approvedToday              lawyer_profiles approved AND verified_at = today
//   verifiedToday              approvedToday + rejectedToday
//                              (rejectedToday from lawyer_rejection_history)
// =====================================================================

// Lawyers awaiting verification.
async function countPendingVerifications() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM lawyer_profiles
      WHERE verification_status = $1`,
    ["pending"]
  );
  return rows[0].count;
}

// Of those pending lawyers, how many applied TODAY. The lawyer profile is
// created at registration time, so lawyer_profiles.created_at is the
// "applied" timestamp. CURRENT_DATE compares in the DB server's timezone.
async function countPendingVerificationsToday() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM lawyer_profiles
      WHERE verification_status = $1
        AND created_at::date = CURRENT_DATE`,
    ["pending"]
  );
  return rows[0].count;
}

// Active registrars: users on the 'registrar' role with an active account.
// roles is a reference table — we join through users.role_id, never a
// non-existent users.role column.
async function countActiveRegistrars() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM users
       JOIN roles ON roles.id = users.role_id
      WHERE roles.name = $1
        AND users.account_status = $2`,
    ["registrar", "active"]
  );
  return rows[0].count;
}

// Every user row, all roles included.
async function countTotalUsers() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM users`
  );
  return rows[0].count;
}

// Users created within the last 7 days (rolling window, not calendar week).
async function countNewUsersThisWeek() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM users
      WHERE created_at >= NOW() - INTERVAL '7 days'`
  );
  return rows[0].count;
}

// Lawyers APPROVED today. lawyer_profiles.verified_at is stamped NOW() at
// approval (see approveLawyerRegistrationTx in auth.service.js), so this is
// a real, reliable approval timestamp — approvedToday is genuinely
// computable (it is NOT null).
async function countApprovedToday() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM lawyer_profiles
      WHERE verification_status = $1
        AND verified_at::date = CURRENT_DATE`,
    ["approved"]
  );
  return rows[0].count;
}

// Lawyers REJECTED today. On rejection the user row is deleted and an audit
// row is written to lawyer_rejection_history with rejected_at = NOW(), so the
// rejection-history table is the source of truth for same-day rejections.
async function countRejectedToday() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM lawyer_rejection_history
      WHERE rejected_at::date = CURRENT_DATE`
  );
  return rows[0].count;
}

// =====================================================================
// Admin dashboard — Recent Activity feed.
//
// There is NO general audit-log table, so the feed is synthesized by
// UNION ALL-ing real events from their own real timestamp columns, then
// ordering the combined set newest-first and taking the top N. Every
// branch selects the SAME column shape:
//
//   id        synthetic stable key  -> type || ':' || sourceRowId
//   type      short enum the frontend maps to an icon/colour
//   title     fixed human label for the event
//   subject   the entity the event is about (lawyer / registrar / case name)
//   ts        the event's real timestamp (used only for ORDER BY)
//
// Event sources (all timestamps are real columns — nothing fabricated):
//   lawyer_approved   lawyer_profiles approved, ts = verified_at,
//                     subject = lawyer name (users join)
//   lawyer_rejected   lawyer_rejection_history, ts = rejected_at,
//                     subject = the lawyer name stored on the audit row
//   lawyer_requested  lawyer_profiles pending, ts = created_at,
//                     subject = lawyer name (users join)
//   registrar_created users(role=registrar), ts = created_at,
//                     subject = registrar name
//   case_accepted /   cases status in (accepted,returned),
//   case_returned     ts = reviewed_at, subject = case title
//                     (+ reviewing registrar name when present)
//
// We deliberately omit any "client verification" event: clients self-
// register with no admin approval, so there is no source row for it.
//
// LIMIT is applied at the outer query so the DB does the ordering across
// all sources. Parameterised throughout (no string interpolation of the
// limit or the status literals).
// =====================================================================
async function getRecentActivity(limit = 8) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 8, 1), 50);

  const { rows } = await pool.query(
    `
    SELECT id, type, title, subject, ts AS timestamp
    FROM (
      -- Lawyer verification approved.
      SELECT
        'lawyer_approved:' || lp.id        AS id,
        'lawyer_approved'                  AS type,
        'Lawyer verification approved'     AS title,
        TRIM(u.first_name || ' ' || u.last_name) AS subject,
        lp.verified_at                     AS ts
      FROM lawyer_profiles lp
      JOIN users u ON u.id = lp.user_id
      WHERE lp.verification_status = $1
        AND lp.verified_at IS NOT NULL

      UNION ALL

      -- Lawyer verification rejected (audit row; user already deleted, so
      -- the name is read from the snapshot stored on the history row).
      SELECT
        'lawyer_rejected:' || rh.id        AS id,
        'lawyer_rejected'                  AS type,
        'Lawyer verification rejected'     AS title,
        TRIM(COALESCE(rh.first_name, '') || ' ' || COALESCE(rh.last_name, '')) AS subject,
        rh.rejected_at                     AS ts
      FROM lawyer_rejection_history rh

      UNION ALL

      -- New lawyer verification request (still pending).
      SELECT
        'lawyer_requested:' || lp.id       AS id,
        'lawyer_requested'                 AS type,
        'New lawyer verification request'  AS title,
        TRIM(u.first_name || ' ' || u.last_name) AS subject,
        lp.created_at                      AS ts
      FROM lawyer_profiles lp
      JOIN users u ON u.id = lp.user_id
      WHERE lp.verification_status = $2

      UNION ALL

      -- New registrar account provisioned by an admin.
      SELECT
        'registrar_created:' || u.id       AS id,
        'registrar_created'                AS type,
        'Created new registrar account'    AS title,
        TRIM(u.first_name || ' ' || u.last_name) AS subject,
        u.created_at                       AS ts
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE r.name = $3

      UNION ALL

      -- Case accepted by a registrar.
      SELECT
        'case_accepted:' || c.id           AS id,
        'case_accepted'                    AS type,
        'Case accepted'                    AS title,
        CASE
          WHEN ru.id IS NOT NULL
            THEN c.title || ' (by ' || TRIM(ru.first_name || ' ' || ru.last_name) || ')'
          ELSE c.title
        END                                AS subject,
        c.reviewed_at                      AS ts
      FROM cases c
      LEFT JOIN users ru ON ru.id = c.reviewed_by_registrar_id
      WHERE c.status = $4
        AND c.reviewed_at IS NOT NULL

      UNION ALL

      -- Case returned to the lawyer by a registrar.
      SELECT
        'case_returned:' || c.id           AS id,
        'case_returned'                    AS type,
        'Case returned'                    AS title,
        CASE
          WHEN ru.id IS NOT NULL
            THEN c.title || ' (by ' || TRIM(ru.first_name || ' ' || ru.last_name) || ')'
          ELSE c.title
        END                                AS subject,
        c.reviewed_at                      AS ts
      FROM cases c
      LEFT JOIN users ru ON ru.id = c.reviewed_by_registrar_id
      WHERE c.status = $5
        AND c.reviewed_at IS NOT NULL
    ) AS activity
    ORDER BY ts DESC
    LIMIT $6
    `,
    ["approved", "pending", "registrar", "accepted", "returned", safeLimit]
  );

  return {
    activities: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      subject: row.subject,
      timestamp: row.timestamp
    }))
  };
}

export async function getRecentActivityFeed(limit = 8) {
  return getRecentActivity(limit);
}

export async function getDashboardStats() {
  const [
    pendingVerifications,
    pendingVerificationsToday,
    activeRegistrars,
    totalUsers,
    newUsersThisWeek,
    approvedToday,
    rejectedToday,
  ] = await Promise.all([
    countPendingVerifications(),
    countPendingVerificationsToday(),
    countActiveRegistrars(),
    countTotalUsers(),
    countNewUsersThisWeek(),
    countApprovedToday(),
    countRejectedToday(),
  ]);

  // verifiedToday = lawyers whose verification was DECIDED today
  //               = approved today + rejected today.
  const verifiedToday = approvedToday + rejectedToday;

  return {
    pendingVerifications,
    pendingVerificationsToday,
    activeRegistrars,
    // No presence tracking exists in this system — cannot be computed.
    registrarsOnline: null,
    totalUsers,
    newUsersThisWeek,
    verifiedToday,
    approvedToday,
  };
}
