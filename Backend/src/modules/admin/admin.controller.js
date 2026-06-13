import { getDashboardStats } from "./admin.service.js";

// GET /api/admin/dashboard-stats
// Returns the real counts behind the admin dashboard's four stat cards.
// Any metric without a reliable source column is null (never fabricated).
export async function getDashboardStatsHandler(req, res) {
  const stats = await getDashboardStats();
  return res.status(200).json(stats);
}
