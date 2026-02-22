import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  CheckCheck,
  CheckCircle2,
  Trash2,
  UserCheck,
} from "lucide-react";

import { AdminHeader } from "../components/AdminHeader";
import LogoutConfirmationModal from "../components/modals/LogoutConfirmationModal";
import type { AdminNotification } from "../types";
import { useAdminNotificationsStore } from "../store/notifications.store";

type NotificationFilter = "all" | "unread" | "read";

const formatTime = (isoDate: string) =>
  new Date(isoDate).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const categoryLabel: Record<AdminNotification["category"], string> = {
  lawyer_verification: "Lawyer Verification",
  system_statistics: "System Statistics",
  registrar_management: "Registrar Management",
};

const severityClasses: Record<AdminNotification["severity"], string> = {
  success: "bg-emerald-100 text-emerald-700",
  info: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-700",
};

const CategoryIcon = ({ category }: { category: AdminNotification["category"] }) => {
  if (category === "lawyer_verification") {
    return <UserCheck className="h-4 w-4 text-emerald-700" />;
  }
  if (category === "system_statistics") {
    return <BarChart3 className="h-4 w-4 text-blue-700" />;
  }
  return <Bell className="h-4 w-4 text-gray-700" />;
};

export default function Notifications() {
  const navigate = useNavigate();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const notifications = useAdminNotificationsStore((state) => state.notifications);
  const markAsRead = useAdminNotificationsStore((state) => state.markAsRead);
  const markAllAsRead = useAdminNotificationsStore((state) => state.markAllAsRead);
  const removeNotification = useAdminNotificationsStore((state) => state.removeNotification);
  const clearAllNotifications = useAdminNotificationsStore((state) => state.clearAllNotifications);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );
  const readCount = useMemo(
    () => notifications.filter((item) => item.isRead).length,
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((item) => !item.isRead);
    }
    if (filter === "read") {
      return notifications.filter((item) => item.isRead);
    }
    return notifications;
  }, [notifications, filter]);

  const handleLogout = () => {
    localStorage.clear();
    setLogoutModalOpen(false);
    navigate({ to: "/login" });
  };

  return (
    <>
      <LogoutConfirmationModal
        open={logoutModalOpen}
        onCancel={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
      />

      <div className="min-h-screen bg-gray-50">
        <AdminHeader
          title="Notifications"
          subtitle="Admin Alerts and Verification Updates"
          onOpenNotifications={() => navigate({ to: "/admin-notifications" })}
          onLogout={() => setLogoutModalOpen(true)}
        />

        <div className="w-full px-6 lg:px-8 xl:px-10 py-8 space-y-6">
          <section className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-[#01411C]">Admin Notification Center</h1>
            <p className="mt-1 text-sm text-gray-600">
              Track lawyer registration approvals and system statistics notifications in one place.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Unread
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{unreadCount}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Read
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-800">{readCount}</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Total
                </p>
                <p className="mt-1 text-2xl font-bold text-blue-900">{notifications.length}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                    filter === "all" ? "bg-[#01411C] text-white" : "text-gray-600"
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("unread")}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                    filter === "unread" ? "bg-[#01411C] text-white" : "text-gray-600"
                  }`}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("read")}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                    filter === "read" ? "bg-[#01411C] text-white" : "text-gray-600"
                  }`}
                >
                  Read ({readCount})
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCheck className="h-4 w-4" />
                  Mark All as Read
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Clear all notifications?")) {
                      clearAllNotifications();
                    }
                  }}
                  disabled={notifications.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {filteredNotifications.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-gray-600">
                  No notifications available for this filter.
                </div>
              ) : (
                filteredNotifications.map((notification) => (
                  <article
                    key={notification.id}
                    className={`rounded-lg border p-4 ${
                      notification.isRead
                        ? "border-gray-200 bg-white"
                        : "border-emerald-200 bg-emerald-50/40"
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-white p-2 border border-gray-200">
                          <CategoryIcon category={notification.category} />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                              {categoryLabel[notification.category]}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${severityClasses[notification.severity]}`}
                            >
                              {notification.severity}
                            </span>
                            {!notification.isRead ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                New
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-gray-700">{notification.message}</p>
                          <p className="mt-2 text-xs text-gray-500">
                            {formatTime(notification.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {!notification.isRead ? (
                          <button
                            type="button"
                            onClick={() => markAsRead(notification.id)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Mark Read
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removeNotification(notification.id)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
