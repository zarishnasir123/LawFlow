// UI notification shape for the registrar bell + card + drawer. The API layer
// (api/notificationApi.ts) maps the backend's richer `type` string (e.g.
// "case_submitted", "manual_scheduling_needed") onto this UI shape.
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "case" | "hearing" | "message" | "document" | "payment" | "system";
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  caseId?: string;
}

export interface NotificationResponse {
  notifications: Notification[];
  unreadCount: number;
}

// Raw row from GET /api/notifications (camelCase from the notifications service).
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
