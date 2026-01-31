import type { Notification, NotificationResponse } from "../types/notification";

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60 * 1000).toISOString();

// Frontend-only mock data for client notifications.
let mockNotifications: Notification[] = [
  {
    id: "1",
    title: "Document Sent for Signature",
    message: "Your lawyer sent a Vakalatnama for review and signature.",
    type: "document",
    read: false,
    createdAt: minutesAgo(10),
    actionUrl: "/case-tracking?view=pending",
  },
  {
    id: "2",
    title: "Hearing Scheduled",
    message: "Your hearing is scheduled for Jan 30, 2025 at 10:00 AM.",
    type: "hearing",
    read: false,
    createdAt: minutesAgo(60),
    actionUrl: "/client-hearings",
  },
  {
    id: "3",
    title: "New Message",
    message: "Your lawyer sent you a new message.",
    type: "message",
    read: false,
    createdAt: minutesAgo(120),
    actionUrl: "/client-messages",
  },
  {
    id: "4",
    title: "Case Status Updated",
    message: "Your case status was updated to Hearing Scheduled.",
    type: "case",
    read: true,
    createdAt: minutesAgo(240),
    actionUrl: "/case-tracking",
  },
  {
    id: "5",
    title: "System Update",
    message: "A system update is planned for this weekend.",
    type: "system",
    read: true,
    createdAt: minutesAgo(1440),
  },
];

const buildResponse = (): NotificationResponse => ({
  notifications: [...mockNotifications],
  unreadCount: mockNotifications.filter((n) => !n.read).length,
});

export async function fetchNotifications(): Promise<NotificationResponse> {
  return buildResponse();
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  mockNotifications = mockNotifications.map((n) =>
    n.id === notificationId ? { ...n, read: true } : n
  );
}

export async function markAllNotificationsAsRead(): Promise<void> {
  mockNotifications = mockNotifications.map((n) => ({ ...n, read: true }));
}

export async function deleteNotification(notificationId: string): Promise<void> {
  mockNotifications = mockNotifications.filter((n) => n.id !== notificationId);
}
