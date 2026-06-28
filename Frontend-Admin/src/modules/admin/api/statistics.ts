import { apiClient } from "../../../shared/api/axios";
import type { AdminStatisticsSnapshot, StatisticsRange } from "../types";

// Mirror of GET /api/admin/statistics — returns the full snapshot (cards +
// charts) computed from real data for the chosen time range. Shape-identical to
// what the page renders, so it's a drop-in replacement for the old mock.
export async function getStatistics(
  range: StatisticsRange
): Promise<AdminStatisticsSnapshot> {
  const { data } = await apiClient.get<AdminStatisticsSnapshot>(
    "/admin/statistics",
    { params: { range } }
  );
  return data;
}
