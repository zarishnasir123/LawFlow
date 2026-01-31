import type { Notification, NotificationResponse } from "../types/notification";

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60 * 1000).toISOString();

// Frontend-only mock data for notifications.
let mockNotifications: Notification[] = [
  {
    id: "1",
    title: "Case Status Updated",
    message: "Your case 'Smith v. Johnson' has been moved to hearing stage",
    type: "case",
    read: false,
    createdAt: minutesAgo(5),
    caseId: "case-001",
    actionUrl: "/lawyer-cases",
  },
  {
    id: "2",
    title: "Hearing Scheduled",
    message: "Hearing scheduled for Dec 20, 2024 at 10:00 AM",
    type: "hearing",
    read: false,
    createdAt: minutesAgo(30),
    actionUrl: "/lawyer-hearings",
  },
  {
    id: "3",
    title: "New Message",
    message: "Your client John Doe sent you a message",
    type: "message",
    read: false,
    createdAt: minutesAgo(60),
    senderId: "client-001",
    actionUrl: "/lawyer-messages",
  },
  {
    id: "4",
    title: "Document Ready for Review",
    message: "The contract document for case 'Ahmed v. Khan' is ready for review",
    type: "document",
    read: true,
    createdAt: minutesAgo(120),
    caseId: "case-002",
    actionUrl: "/lawyer-case-editor/case-002",
  },
  {
    id: "5",
    title: "System Maintenance",
    message: "System will be under maintenance on Dec 18 from 2 AM to 4 AM UTC",
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
