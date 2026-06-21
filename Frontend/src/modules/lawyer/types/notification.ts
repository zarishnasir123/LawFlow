// UI notification shape consumed by NotificationCard / NotificationModal /
// the Notifications page. The visual layer keys icons + colors off `type`
// (the broad category) and tracks read state via `read`. The live backend
// returns a richer `type` string (e.g. "case_accepted") + `isRead`; the API
// layer (notificationApi.ts) maps the backend shape onto this UI shape so the
// existing components render unchanged.
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "case" | "hearing" | "message" | "document" | "payment" | "system";
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  caseId?: string;
  senderId?: string;
}

export interface NotificationResponse {
  notifications: Notification[];
  unreadCount: number;
}

export type NotificationType = "case" | "hearing" | "message" | "document" | "payment" | "system";

// Raw notification row as returned by GET /api/notifications. camelCase,
// straight from the notifications service mapNotification(). `type` is a
// free-form backend identifier (case_accepted, case_returned, ...) — the API
// layer narrows it to the UI category union above.
export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  caseId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ApiNotificationResponse {
  notifications: ApiNotification[];
  unreadCount: number;
}
