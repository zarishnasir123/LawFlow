import { apiClient } from "../../../shared/api/axios";

// One in-app notification for the logged-in admin (same shape the backend
// returns for every role). `type` is a free string (e.g. "payout_requested",
// "lawyer_pending_verification") the UI maps to an icon/label.
export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  caseId: string | null;
  isRead: boolean;
  createdAt: string;
};

export type NotificationsResponse = {
  notifications: AdminNotification[];
  unreadCount: number;
};

export async function fetchNotifications(): Promise<NotificationsResponse> {
  const { data } = await apiClient.get<NotificationsResponse>("/notifications");
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  const { data } = await apiClient.patch<{ updated: number }>(
    "/notifications/read-all"
  );
  return data;
}

export async function deleteNotification(id: string): Promise<void> {
  await apiClient.delete(`/notifications/${id}`);
}

// Where a notification routes the admin when clicked. The two real admin events
// open their action queue; anything else is non-navigating.
export function notificationActionPath(type: string): string | undefined {
  if (type.startsWith("payout")) return "/payouts";
  if (type === "lawyer_pending_verification") return "/verifications";
  return undefined;
}

// ---------------------------------------------------------------------------
// Email notification preferences. The in-app center always shows everything;
// this only controls which EMAILS the admin receives. The admin's optional
// emails are the two action alerts — a new lawyer to verify, and a payout
// request — so the settings UI exposes just those two toggles + the master
// switch. The backend object carries every category, so we keep the full type.
// ---------------------------------------------------------------------------
export interface NotificationPreferences {
  emailEnabled: boolean;
  case: boolean;
  hearing: boolean;
  message: boolean;
  document: boolean;
  payment: boolean;
  verification: boolean;
  payout: boolean;
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await apiClient.get<{ preferences: NotificationPreferences }>(
    "/notifications/preferences"
  );
  return data.preferences;
}

export async function updateNotificationPreferences(
  patch: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const { data } = await apiClient.put<{ preferences: NotificationPreferences }>(
    "/notifications/preferences",
    patch
  );
  return data.preferences;
}
