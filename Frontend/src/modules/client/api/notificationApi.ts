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
  if (backendType.startsWith("case")) return "case";
  if (backendType.startsWith("hearing")) return "hearing";
  if (backendType.startsWith("message")) return "message";
  if (backendType.startsWith("document")) return "document";
  return "system";
}

// Derive a click-through route. Hearing and outcome notifications (completed,
// adjourned, case_disposed) all go to the hearings page. Case-level
// notifications go to case-tracking. Anything else falls back to undefined.
function mapActionUrl(backendType: string, caseId: string | null): string | undefined {
  if (
    backendType.startsWith("hearing") ||
    backendType === "case_disposed"
  ) return "/client-hearings";
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

export async function fetchNotifications(): Promise<NotificationResponse> {
  const { data } = await apiClient.get<ApiNotificationResponse>("/notifications");
  return {
    notifications: data.notifications.map(mapNotification),
    unreadCount: data.unreadCount,
  };
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  await apiClient.patch(`/notifications/${notificationId}/read`);
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await apiClient.patch("/notifications/read-all");
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await apiClient.delete(`/notifications/${notificationId}`);
}
