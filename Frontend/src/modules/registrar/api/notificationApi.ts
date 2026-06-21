import { apiClient } from "../../../shared/api/axios";
import type {
  ApiNotification,
  ApiNotificationResponse,
  Notification,
  NotificationResponse,
} from "../types/notification";

// Live registrar notification API. Scoped server-side to the logged-in
// registrar, so they only ever see / act on their OWN notifications.

// Map a backend `type` onto the broad UI category the card keys its icon off.
function mapType(backendType: string): Notification["type"] {
  if (backendType.startsWith("case")) return "case";
  if (
    backendType.startsWith("hearing") ||
    backendType.startsWith("manual")
  )
    return "hearing";
  if (backendType.startsWith("chat") || backendType.startsWith("message"))
    return "message";
  if (backendType.startsWith("document") || backendType.startsWith("signature"))
    return "document";
  if (backendType.startsWith("payment") || backendType.startsWith("payout"))
    return "payment";
  return "system";
}

// Where a notification routes the registrar. Case submissions open the review
// queue; manual-scheduling alerts open the hearings page.
function mapActionUrl(backendType: string, caseId: string | null): string | undefined {
  if (backendType.startsWith("manual") || backendType.startsWith("hearing")) {
    return "/registrar-hearings";
  }
  if (backendType.startsWith("case")) return "/view-cases";
  return caseId ? "/view-cases" : undefined;
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
export async function markNotificationAsRead(notificationId: string): Promise<void> {
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
// Email notification preferences. The in-app bell always shows everything; this
// only controls which EMAILS the registrar receives. The registrar's sole
// optional email is the "new case awaiting review" alert (the `case` category),
// so the settings view exposes just that toggle + the master switch — but the
// backend object carries every category, so we keep the full type.
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
