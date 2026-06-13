import { apiClient } from "../../../shared/api/axios";

// Mirror of the backend GET /api/admin/dashboard-stats payload. Any metric
// the backend cannot compute from a real column comes back as `null`
// (registrarsOnline is always null — there is no presence tracking). The UI
// hides the corresponding sub-line rather than rendering a fake number.
export type AdminDashboardStats = {
  pendingVerifications: number;
  pendingVerificationsToday: number | null;
  activeRegistrars: number;
  registrarsOnline: number | null;
  totalUsers: number;
  newUsersThisWeek: number | null;
  verifiedToday: number | null;
  approvedToday: number | null;
};

export async function getDashboardStats(): Promise<AdminDashboardStats> {
  const { data } = await apiClient.get<AdminDashboardStats>(
    "/admin/dashboard-stats"
  );
  return data;
}
