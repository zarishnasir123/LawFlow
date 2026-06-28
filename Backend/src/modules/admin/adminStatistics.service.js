import { pool } from "../../config/db.js";

// =====================================================================
// Admin "Statistics" page — real data for every card and chart.
//
// One endpoint, `getAdminStatistics(range)`, runs ~15 small independent
// aggregates concurrently (same style as getDashboardStats / getMoneyOverview)
// and assembles the exact AdminStatisticsSnapshot shape the frontend already
// renders, so the page is a drop-in swap of its mock.
//
// Ranges bucket time differently: week → 7 daily buckets, month → 6 monthly,
// year → 12 monthly. Empty buckets are kept (shown as 0) via generate_series.
// All timestamps use server-local CURRENT_DATE / date_trunc / NOW(), matching
// the rest of the admin module.
// =====================================================================

export const STATISTICS_RANGES = ["week", "month", "year"];

const RANGE_CONFIG = {
  week: { rangeLabel: "Last 7 Days", bucket: "day", periods: 7, revenueTitle: "Revenue" },
  month: { rangeLabel: "Last 6 Months", bucket: "month", periods: 6, revenueTitle: "Revenue (6 Months)" },
  year: { rangeLabel: "Last 12 Months", bucket: "month", periods: 12, revenueTitle: "Revenue (12 Months)" },
};

const round2 = (n) => Math.round(Number(n) * 100) / 100;

// --- display formatters (the metric cards + summary boxes render strings) ----
function formatCount(n) {
  return (Number(n) || 0).toLocaleString("en-US");
}
function formatRs(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `Rs. ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `Rs. ${Math.round(v / 1000)}k`;
  return `Rs. ${Math.round(v).toLocaleString("en-US")}`;
}
// Window-over-window growth as a signed % string; "—" when there's no baseline.
function pctChange(cur, prev) {
  const c = Number(cur) || 0;
  const p = Number(prev) || 0;
  if (p === 0) return c > 0 ? "+100%" : "—";
  const pct = ((c - p) / p) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

// --- label helpers (format bucket_start in JS to avoid DB-locale surprises) ---
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function bucketLabel(value, unit) {
  const d = value instanceof Date ? value : new Date(value);
  return unit === "month" ? MONTHS_SHORT[d.getMonth()] : WEEKDAYS_SHORT[d.getDay()];
}

// --- color metadata -----------------------------------------------------------
const CASE_TYPE_PALETTE = [
  "#059669", "#16a34a", "#0891b2", "#10b981", "#34d399",
  "#6ee7b7", "#047857", "#065f46", "#a7f3d0",
];
const USER_TYPE_META = [
  { role: "client", name: "Clients", color: "#059669" },
  { role: "lawyer", name: "Lawyers", color: "#2563eb" },
  { role: "registrar", name: "Registrars", color: "#7c3aed" },
  { role: "admin", name: "Admins", color: "#f59e0b" },
];
const CASE_STATUS_META = {
  submitted: { name: "Under Review", color: "#f59e0b" },
  accepted: { name: "Accepted", color: "#10b981" },
  returned: { name: "Returned", color: "#ef4444" },
  disposed: { name: "Disposed", color: "#2563eb" },
  draft: { name: "Draft", color: "#94a3b8" },
};

// Bounds for window-over-window growth: the current window of `periods` units
// ending this period, and the immediately-preceding window of equal length.
// $1 = bucket unit ('day'|'month'), $2 = period count.
const BOUNDS_CTE = `
  WITH bounds AS (
    SELECT
      date_trunc($1::text, CURRENT_DATE)::timestamp - (($2::int - 1) || ' ' || $1::text)::interval     AS w_start,
      date_trunc($1::text, CURRENT_DATE)::timestamp + ('1 ' || $1::text)::interval                     AS w_end,
      date_trunc($1::text, CURRENT_DATE)::timestamp - ((2 * $2::int - 1) || ' ' || $1::text)::interval AS p_start
  )
`;

// One row per bucket across the window (empty buckets included). $1 = unit, $2 = count.
const BUCKETS_CTE = `
  WITH buckets AS (
    SELECT generate_series(
      date_trunc($1::text, CURRENT_DATE)::timestamp - (($2::int - 1) || ' ' || $1::text)::interval,
      date_trunc($1::text, CURRENT_DATE)::timestamp,
      ('1 ' || $1::text)::interval
    ) AS bucket_start
  )
`;

// --- assembly helpers ---------------------------------------------------------
function buildCaseTypeDistribution(rows) {
  const nonZero = rows.filter((r) => r.value > 0);
  const top = nonZero.slice(0, 8);
  const restSum = nonZero.slice(8).reduce((s, r) => s + r.value, 0);
  const out = top.map((r, i) => ({
    name: r.name,
    value: r.value,
    color: CASE_TYPE_PALETTE[i % CASE_TYPE_PALETTE.length],
  }));
  if (restSum > 0) {
    out.push({ name: "Others", value: restSum, color: CASE_TYPE_PALETTE[8] });
  }
  return out;
}

function buildUserTypeDistribution(rows) {
  const byRole = Object.fromEntries(rows.map((r) => [r.role, r.value]));
  return USER_TYPE_META.map((m) => ({ name: m.name, value: byRole[m.role] ?? 0, color: m.color }));
}

function buildVerificationStatus(row) {
  const out = [
    { status: "Approved", lawyers: row.approved, clients: 0 },
    { status: "Pending", lawyers: row.pending, clients: 0 },
    { status: "Rejected", lawyers: row.rejected, clients: 0 },
  ];
  if (row.suspended > 0) out.push({ status: "Suspended", lawyers: row.suspended, clients: 0 });
  return out;
}

function buildCaseStatusDistribution(rows) {
  return rows
    .filter((r) => r.value > 0 && CASE_STATUS_META[r.status])
    .map((r) => ({
      name: CASE_STATUS_META[r.status].name,
      value: r.value,
      color: CASE_STATUS_META[r.status].color,
    }));
}

export async function getAdminStatistics(range = "month") {
  const resolved = RANGE_CONFIG[range] ? range : "month";
  const cfg = RANGE_CONFIG[resolved];
  const wp = [cfg.bucket, cfg.periods]; // params for windowed / series queries

  const [
    userCounts,
    caseCounts,
    revenue,
    activeToday,
    avgDau,
    regTrend,
    revenueSeries,
    dau7,
    caseTypes,
    userTypes,
    verif,
    caseStatus,
    registrarPerf,
    lawyerCount,
    avgProc,
  ] = await Promise.all([
    // 1. Users: all-time total + current/previous window for growth.
    pool.query(
      `${BOUNDS_CTE}
       SELECT
         (SELECT COUNT(*) FROM users)::int AS total,
         (SELECT COUNT(*) FROM users u, bounds b
            WHERE u.created_at >= b.w_start AND u.created_at < b.w_end)::int AS current,
         (SELECT COUNT(*) FROM users u, bounds b
            WHERE u.created_at >= b.p_start AND u.created_at < b.w_start)::int AS previous`,
      wp
    ),
    // 2. Cases: all-time total + current/previous window.
    pool.query(
      `${BOUNDS_CTE}
       SELECT
         (SELECT COUNT(*) FROM cases)::int AS total,
         (SELECT COUNT(*) FROM cases c, bounds b
            WHERE c.created_at >= b.w_start AND c.created_at < b.w_end)::int AS current,
         (SELECT COUNT(*) FROM cases c, bounds b
            WHERE c.created_at >= b.p_start AND c.created_at < b.w_start)::int AS previous`,
      wp
    ),
    // 3. Revenue (platform commission): window current/previous + all-time.
    pool.query(
      `${BOUNDS_CTE}
       SELECT
         COALESCE(SUM(platform_fee_amount) FILTER (
           WHERE status = 'success'
             AND created_at >= (SELECT w_start FROM bounds)
             AND created_at <  (SELECT w_end FROM bounds)), 0)::float AS current,
         COALESCE(SUM(platform_fee_amount) FILTER (
           WHERE status = 'success'
             AND created_at >= (SELECT p_start FROM bounds)
             AND created_at <  (SELECT w_start FROM bounds)), 0)::float AS previous,
         COALESCE(SUM(platform_fee_amount) FILTER (WHERE status = 'success'), 0)::float AS all_time
       FROM payment_transactions`,
      wp
    ),
    // 4. Active today (distinct users in the daily ledger).
    pool.query(
      `SELECT COUNT(DISTINCT user_id)::int AS n
         FROM user_activity WHERE activity_date = CURRENT_DATE`
    ),
    // 5. Average DAU over the last 12 months vs the prior 12 (for the year card).
    pool.query(
      `SELECT
         COALESCE(ROUND(AVG(daily) FILTER (
           WHERE activity_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'))::numeric, 0)::int AS current,
         COALESCE(ROUND(AVG(daily) FILTER (
           WHERE activity_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '23 months'
             AND activity_date <  date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'))::numeric, 0)::int AS previous
       FROM (
         SELECT activity_date, COUNT(DISTINCT user_id) AS daily
         FROM user_activity GROUP BY activity_date
       ) d`
    ),
    // 6. Registration trend: clients vs lawyers per bucket.
    pool.query(
      `${BUCKETS_CTE}
       SELECT
         b.bucket_start,
         COUNT(*) FILTER (WHERE r.name = 'client')::int AS clients,
         COUNT(*) FILTER (WHERE r.name = 'lawyer')::int AS lawyers
       FROM buckets b
       LEFT JOIN users u ON date_trunc($1::text, u.created_at) = b.bucket_start
       LEFT JOIN roles r ON r.id = u.role_id
       GROUP BY b.bucket_start
       ORDER BY b.bucket_start`,
      wp
    ),
    // 7. Revenue series (platform fees per bucket).
    pool.query(
      `${BUCKETS_CTE}
       SELECT
         b.bucket_start,
         COALESCE(SUM(pt.platform_fee_amount) FILTER (WHERE pt.status = 'success'), 0)::float AS revenue
       FROM buckets b
       LEFT JOIN payment_transactions pt ON date_trunc($1::text, pt.created_at) = b.bucket_start
       GROUP BY b.bucket_start
       ORDER BY b.bucket_start`,
      wp
    ),
    // 8. Daily active users — always the last 7 days (section is hard-titled).
    pool.query(
      `WITH days AS (
         SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day')::date AS d
       )
       SELECT days.d, COUNT(DISTINCT ua.user_id)::int AS users
       FROM days LEFT JOIN user_activity ua ON ua.activity_date = days.d
       GROUP BY days.d ORDER BY days.d`
    ),
    // 9. Case type distribution (real 10 templates).
    pool.query(
      `SELECT ct.display_name AS name, COUNT(c.id)::int AS value
         FROM case_types ct
         LEFT JOIN cases c ON c.case_type_id = ct.id
        GROUP BY ct.id, ct.display_name, ct.sort_order
        ORDER BY value DESC, ct.sort_order ASC`
    ),
    // 10. User type distribution (by role).
    pool.query(
      `SELECT r.name AS role, COUNT(u.id)::int AS value
         FROM roles r LEFT JOIN users u ON u.role_id = r.id
        GROUP BY r.name`
    ),
    // 11. Lawyer verification breakdown (clients aren't verified → 0 in assembly).
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE verification_status = 'approved')::int  AS approved,
         COUNT(*) FILTER (WHERE verification_status = 'pending')::int   AS pending,
         COUNT(*) FILTER (WHERE verification_status = 'rejected')::int  AS rejected,
         COUNT(*) FILTER (WHERE verification_status = 'suspended')::int AS suspended
       FROM lawyer_profiles`
    ),
    // 12. Case status distribution.
    pool.query(`SELECT status, COUNT(*)::int AS value FROM cases GROUP BY status`),
    // 13. Registrar performance (top 5 by cases reviewed). Each registrar is
    // assigned a tehsil (their court jurisdiction), surfaced alongside the name.
    pool.query(
      `SELECT
         TRIM(u.first_name || ' ' || u.last_name) AS name,
         COALESCE(rp.assigned_tehsil, '') AS tehsil,
         COUNT(c.id)::int AS processed,
         COUNT(c.id) FILTER (WHERE c.status IN ('accepted','disposed'))::int AS approved,
         COUNT(c.id) FILTER (WHERE c.status = 'returned')::int AS returned
       FROM users u
       JOIN roles r ON r.id = u.role_id AND r.name = 'registrar'
       LEFT JOIN registrar_profiles rp ON rp.user_id = u.id
       LEFT JOIN cases c ON c.reviewed_by_registrar_id = u.id AND c.reviewed_at IS NOT NULL
       GROUP BY u.id, u.first_name, u.last_name, rp.assigned_tehsil
       ORDER BY processed DESC, name ASC
       LIMIT 5`
    ),
    // 14. Lawyer count (for Average Cases / Lawyer).
    pool.query(`SELECT COUNT(*)::int AS n FROM lawyer_profiles`),
    // 15. Average processing time (submit → review), in seconds.
    pool.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (reviewed_at - submitted_at)))::float AS avg_seconds
         FROM cases
        WHERE reviewed_at IS NOT NULL AND submitted_at IS NOT NULL AND reviewed_at >= submitted_at`
    ),
  ]);

  const uc = userCounts.rows[0];
  const cc = caseCounts.rows[0];
  const rev = revenue.rows[0];
  const dau = avgDau.rows[0];

  // --- metric cards (order MUST stay users, cases, revenue, active) ----------
  const metrics = [
    { id: "users", title: "Total Users", value: formatCount(uc.total), change: pctChange(uc.current, uc.previous), tone: "blue" },
    { id: "cases", title: "Total Cases", value: formatCount(cc.total), change: pctChange(cc.current, cc.previous), tone: "violet" },
    { id: "revenue", title: cfg.revenueTitle, value: formatRs(rev.current), change: pctChange(rev.current, rev.previous), tone: "emerald" },
    resolved === "year"
      ? { id: "active", title: "Average Active / Day", value: formatCount(dau.current), change: pctChange(dau.current, dau.previous), tone: "orange" }
      : { id: "active", title: "Active Today", value: formatCount(activeToday.rows[0].n), change: "Live", tone: "orange" },
  ];

  // --- summary boxes ---------------------------------------------------------
  const lc = lawyerCount.rows[0].n;
  const v = verif.rows[0];
  const approvalDenom = v.approved + v.rejected;
  const avgSeconds = avgProc.rows[0].avg_seconds;
  const summaryStats = [
    { id: "avgCases", label: "Average Cases / Lawyer", value: lc === 0 ? "0.00" : (cc.total / lc).toFixed(2), tone: "blue" },
    { id: "approval", label: "Approval Rate", value: approvalDenom === 0 ? "—" : `${((v.approved / approvalDenom) * 100).toFixed(1)}%`, tone: "emerald" },
    { id: "processing", label: "Avg. Processing Time", value: avgSeconds == null ? "—" : `${(avgSeconds / 86400).toFixed(1)} days`, tone: "violet" },
    { id: "revenue", label: "Platform Revenue", value: formatRs(rev.all_time), tone: "orange" },
  ];

  return {
    rangeLabel: cfg.rangeLabel,
    metrics,
    userRegistrationTrend: regTrend.rows.map((r) => ({
      label: bucketLabel(r.bucket_start, cfg.bucket),
      clients: r.clients,
      lawyers: r.lawyers,
      total: r.clients + r.lawyers,
    })),
    caseTypeDistribution: buildCaseTypeDistribution(caseTypes.rows),
    userTypeDistribution: buildUserTypeDistribution(userTypes.rows),
    monthlyRevenue: revenueSeries.rows.map((r) => ({
      label: bucketLabel(r.bucket_start, cfg.bucket),
      revenue: round2(r.revenue),
    })),
    verificationStatus: buildVerificationStatus(v),
    caseStatusDistribution: buildCaseStatusDistribution(caseStatus.rows),
    dailyActiveUsers: dau7.rows.map((r) => ({ day: bucketLabel(r.d, "day"), users: r.users })),
    registrarPerformance: registrarPerf.rows.map((r) => ({
      name: r.name,
      tehsil: r.tehsil,
      processed: r.processed,
      approved: r.approved,
      returned: r.returned,
    })),
    summaryStats,
  };
}
