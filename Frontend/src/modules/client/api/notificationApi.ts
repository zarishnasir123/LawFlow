import { apiClient } from "../../../shared/api/axios";
import type {
  ApiNotification,
  ApiNotificationResponse,
  Notification,
  NotificationResponse,
} from "../types/notification";

// Live client notification API (replaces the previous frontend-only mock).
// Talks to the real backend (Backend/src/modules/notifications) via the shared
// apiClient. Every endpoint is scoped server-side to the logged-in user, so a
// client only ever sees / mutates their OWN notifications.

// Map a backend `type` (e.g. "chat_message", "case_accepted") onto the broad
// UI category NotificationCard keys its icon/color off. Unknown types fall
// back to "system" so a new backend type still renders sensibly.
function mapType(backendType: string): Notification["type"] {
  if (backendType.startsWith("chat")) return "message";
  if (backendType.startsWith("message")) return "message";
  if (backendType.startsWith("case")) return "case";
  if (backendType.startsWith("hearing")) return "hearing";
  if (backendType.startsWith("document")) return "document";
  return "system";
}

// Where clicking a notification takes the client. Chat alerts open the
// messages inbox; case-related ones open case tracking; others have no link
// (clicking just marks read).
function mapActionUrl(backendType: string, caseId: string | null): string | undefined {
  if (backendType.startsWith("chat") || backendType.startsWith("message")) {
    return "/client-messages";
  }
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
