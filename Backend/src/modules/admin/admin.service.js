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
