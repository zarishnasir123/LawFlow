export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "case" | "hearing" | "message" | "document" | "system";
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

export type NotificationType = "case" | "hearing" | "message" | "document" | "system";

// Raw notification row as returned by GET /api/notifications (camelCase from
// the notifications service). `type` is a free-form backend identifier
// (chat_message, case_accepted, ...); the API layer narrows it to the UI
// category union above.
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
