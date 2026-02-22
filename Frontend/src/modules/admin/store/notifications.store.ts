import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  AdminNotification,
  AdminNotificationCategory,
  AdminNotificationSeverity,
} from "../types";

type AddNotificationInput = {
  title: string;
  message: string;
  category: AdminNotificationCategory;
  severity?: AdminNotificationSeverity;
};

type AdminNotificationsState = {
  notifications: AdminNotification[];
  addNotification: (input: AddNotificationInput) => AdminNotification;
  addLawyerVerificationNotification: (input: {
    lawyerName: string;
    decision: "approved" | "returned";
  }) => void;
  addSystemStatisticsNotification: (input: {
    title: string;
    message: string;
    severity?: AdminNotificationSeverity;
  }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
};

const nowIso = () => new Date().toISOString();

const createNotification = (
  input: AddNotificationInput & { isRead?: boolean; createdAt?: string; id?: string },
): AdminNotification => ({
  id: input.id ?? `admin-notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: input.title,
  message: input.message,
  category: input.category,
  severity: input.severity ?? "info",
  createdAt: input.createdAt ?? nowIso(),
  isRead: input.isRead ?? false,
});

const seedNotifications: AdminNotification[] = [
  createNotification({
    id: "admin-notif-1",
    title: "Lawyer verification approved",
    message: "Adv. Fatima Ali verification request was approved successfully.",
    category: "lawyer_verification",
    severity: "success",
    createdAt: "2026-02-22T09:55:00.000Z",
  }),
  createNotification({
    id: "admin-notif-2",
    title: "New lawyer registration pending review",
    message: "A new lawyer registration is waiting for verification action.",
    category: "lawyer_verification",
    severity: "warning",
    createdAt: "2026-02-22T08:20:00.000Z",
  }),
  createNotification({
    id: "admin-notif-3",
    title: "System statistics update",
    message: "Daily filing volume increased by 14% compared to yesterday.",
    category: "system_statistics",
    severity: "info",
    createdAt: "2026-02-22T07:40:00.000Z",
  }),
];

export const useAdminNotificationsStore = create<AdminNotificationsState>()(
  persist(
    (set) => ({
      notifications: seedNotifications,

      addNotification: (input) => {
        const created = createNotification(input);
        set((state) => ({
          notifications: [created, ...state.notifications],
        }));
        return created;
      },

      addLawyerVerificationNotification: ({ lawyerName, decision }) => {
        const approved = decision === "approved";
        const created = createNotification({
          title: approved
            ? "Lawyer verification approved"
            : "Lawyer verification returned",
          message: approved
            ? `${lawyerName} has been approved by admin verification.`
            : `${lawyerName} was returned for correction in verification review.`,
          category: "lawyer_verification",
          severity: approved ? "success" : "warning",
        });
        set((state) => ({
          notifications: [created, ...state.notifications],
        }));
      },

      addSystemStatisticsNotification: ({ title, message, severity = "info" }) => {
        const created = createNotification({
          title,
          message,
          category: "system_statistics",
          severity,
        });
        set((state) => ({
          notifications: [created, ...state.notifications],
        }));
      },

      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((item) =>
            item.id === id ? { ...item, isRead: true } : item,
          ),
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((item) => ({
            ...item,
            isRead: true,
          })),
        }));
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((item) => item.id !== id),
        }));
      },

      clearAllNotifications: () => {
        set({ notifications: [] });
      },
    }),
    {
      name: "lawflow_admin_notifications",
      version: 1,
    },
  ),
);

