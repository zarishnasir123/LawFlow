import { apiClient } from "../../../shared/api/axios";
import type {
  ApiNotification,
  ApiNotificationResponse,
  Notification,
  NotificationResponse,
} from "../types/notification";

// Map a backend `type` (e.g. "case_accepted", "case_returned") onto the
// broad UI category the NotificationCard keys its icon/color off of.
function mapType(backendType: string): Notification["type"] {
  if (backendType.startsWith("chat") || backendType.startsWith("message")) return "message";
  if (backendType.startsWith("case")) return "case";
  if (backendType.startsWith("hearing")) return "hearing";
  if (backendType.startsWith("document") || backendType.startsWith("signature")) return "document";
  if (backendType.startsWith("payment") || backendType.startsWith("payout")) return "payment";
  return "system";
}

// Derive a click-through route. Hearing and outcome notifications (completed,
// adjourned, case_disposed) all go to the hearings page. Chat alerts open the
// messages inbox; case-related ones open case tracking; others have no link.
function mapActionUrl(backendType: string, caseId: string | null): string | undefined {
  if (
    backendType.startsWith("hearing") ||
    backendType === "case_disposed"
  ) return "/client-hearings";
  if (backendType.startsWith("chat") || backendType.startsWith("message")) {
    return "/client-messages";
  }
  if (backendType.startsWith("payment")) return "/client-payments";
  if (caseId) return "/case-tracking";
  return undefined;
}

function mapNotification(row: ApiNotification): Notification {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: mapType(row.type),
    read: row.isRead,
    createdAt: row.createdAt,
    caseId: row.caseId ?? undefined,
    actionUrl: mapActionUrl(row.type, row.caseId),
  };
}

// GET /api/notifications -> { notifications, unreadCount }.
export async function fetchNotifications(): Promise<NotificationResponse> {
  const { data } = await apiClient.get<ApiNotificationResponse>("/notifications");
  return {
    notifications: data.notifications.map(mapNotification),
    unreadCount: data.unreadCount,
  };
}

// PATCH /api/notifications/:id/read
export async function markNotificationAsRead(
  notificationId: string
): Promise<void> {
  await apiClient.patch(`/notifications/${notificationId}/read`);
}

// PATCH /api/notifications/read-all
export async function markAllNotificationsAsRead(): Promise<void> {
  await apiClient.patch("/notifications/read-all");
}

// DELETE /api/notifications/:id
export async function deleteNotification(notificationId: string): Promise<void> {
  await apiClient.delete(`/notifications/${notificationId}`);
}

// ---------------------------------------------------------------------------
// Email notification preferences. These control which EMAILS the user gets;
// the in-app bell always shows everything. `emailEnabled` is the master switch;
// the per-category flags gate that category's emails. (No SMS / system updates —
// LawFlow doesn't send those.)
// ---------------------------------------------------------------------------
export interface NotificationPreferences {
  emailEnabled: boolean;
  case: boolean;
  hearing: boolean;
  message: boolean;
  document: boolean;
  payment: boolean;
}

// GET /api/notifications/preferences
export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await apiClient.get<{ preferences: NotificationPreferences }>(
    "/notifications/preferences"
  );
  return data.preferences;
}

// PUT /api/notifications/preferences — accepts a partial patch, returns the
// merged result.
export async function updateNotificationPreferences(
  patch: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const { data } = await apiClient.put<{ preferences: NotificationPreferences }>(
    "/notifications/preferences",
    patch
  );
  return data.preferences;
}
