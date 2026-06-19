import { apiClient } from "../../../shared/api/axios";
import type {
  ApiNotification,
  ApiNotificationResponse,
  Notification,
  NotificationResponse,
} from "../types/notification";

// Live lawyer notification API. Replaces the previous frontend-only mock.
// Talks to the real backend (Backend/src/modules/notifications) via the
// shared apiClient, which attaches the auth header and handles refresh. Every
// endpoint is scoped server-side to the logged-in user, so the lawyer only
// ever sees / marks their OWN notifications.

// Map a backend `type` (e.g. "case_accepted", "case_returned") onto the
// broad UI category the NotificationCard keys its icon/color off of. Anything
// case-related collapses to "case"; unknown types fall back to "system" so a
// new backend type still renders sensibly without a frontend change.
function mapType(backendType: string): Notification["type"] {
  if (backendType.startsWith("case")) return "case";
  if (backendType.startsWith("hearing")) return "hearing";
  if (backendType.startsWith("chat") || backendType.startsWith("message"))
    return "message";
  if (backendType.startsWith("document")) return "document";
  return "system";
}

// Derive a click-through route from the related case id. Accepted/active
// cases open in the editor; returned cases have their own detail page, but
// the editor route handles all statuses, so we use it as the single, always-
// valid destination. Notifications with no caseId get no actionUrl (clicking
// them just marks read).
function mapActionUrl(
  backendType: string,
  caseId: string | null
): string | undefined {
  if (backendType.startsWith("chat") || backendType.startsWith("message")) {
    return "/lawyer-messages";
  }
  return caseId ? `/lawyer-case-editor/${caseId}` : undefined;
}

// Map one backend row onto the UI Notification shape the existing components
// render. The backend's `isRead` becomes the UI's `read`; `caseId` is
// normalised from null to undefined to match the optional UI field.
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

// GET /api/notifications -> { notifications, unreadCount }. The backend caps
// the list (~50, newest first) and computes unreadCount across ALL rows so
// the bell badge stays accurate even past the list cap.
export async function fetchNotifications(): Promise<NotificationResponse> {
  const { data } = await apiClient.get<ApiNotificationResponse>(
    "/notifications"
  );
  return {
    notifications: data.notifications.map(mapNotification),
    unreadCount: data.unreadCount,
  };
}

// PATCH /api/notifications/:id/read -> mark one read. 404s if the id isn't the
// caller's own row.
export async function markNotificationAsRead(
  notificationId: string
): Promise<void> {
  await apiClient.patch(`/notifications/${notificationId}/read`);
}

// PATCH /api/notifications/read-all -> mark every unread one read.
export async function markAllNotificationsAsRead(): Promise<void> {
  await apiClient.patch("/notifications/read-all");
}
