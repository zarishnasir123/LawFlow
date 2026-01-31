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
