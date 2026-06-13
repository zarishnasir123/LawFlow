import { getDashboardStats, getRecentActivityFeed } from "./admin.service.js";

// GET /api/admin/dashboard-stats
// Returns the real counts behind the admin dashboard's four stat cards.
// Any metric without a reliable source column is null (never fabricated).
export async function getDashboardStatsHandler(req, res) {
  const stats = await getDashboardStats();
  return res.status(200).json(stats);
}

// GET /api/admin/recent-activity
// Returns the 8 most recent real system events for the dashboard's Recent
// Activity panel, newest first. The feed is a UNION across real event
// sources (lawyer approvals/rejections/requests, registrar creation, case
// accept/return) — see getRecentActivity in admin.service.js. Shape:
//   { activities: [{ id, type, title, subject, timestamp }] }
export async function getRecentActivityHandler(req, res) {
  const result = await getRecentActivityFeed(8);
  return res.status(200).json(result);
}
