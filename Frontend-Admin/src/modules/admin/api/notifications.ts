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
