import { apiClient } from "../../../shared/api/axios";

// The short enum the backend stamps on each activity row. The frontend maps
// each value to an icon + colour in the RecentActivityList component. Keep this
// union in sync with the literal `type` values produced by getRecentActivity in
// Backend/src/modules/admin/admin.service.js.
export type ActivityType =
  | "lawyer_approved"
  | "lawyer_rejected"
  | "lawyer_requested"
  | "registrar_created"
  | "case_accepted"
  | "case_returned";

// One synthesized event in the dashboard's Recent Activity feed.
//   id        stable synthetic key (e.g. "lawyer_approved:<rowId>")
//   type      enum the UI maps to an icon/colour
//   title     fixed human label ("Lawyer verification approved")
//   subject   the entity the event is about (lawyer / registrar / case name)
//   timestamp ISO time of the real source event (newest first)
export type RecentActivityItem = {
  id: string;
  type: ActivityType;
  title: string;
  subject: string;
  timestamp: string;
};

export type RecentActivityResponse = {
  activities: RecentActivityItem[];
};

// GET /api/admin/recent-activity — the 8 most recent real system events,
// newest first. Admin-gated on the backend.
export async function getRecentActivity(): Promise<RecentActivityItem[]> {
  const { data } = await apiClient.get<RecentActivityResponse>(
    "/admin/recent-activity"
  );
  return data.activities ?? [];
}
