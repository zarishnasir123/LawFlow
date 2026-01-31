import { useState, useEffect } from "react";
import { Check, Trash2, SlidersHorizontal } from "lucide-react";
import LawyerLayout from "../components/LawyerLayout";
import NotificationCard from "../components/NotificationCard";
import NotificationPreferencesModal from "../components/modals/NotificationPreferencesModal";
import type { Notification } from "../types/notification";
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../api/notificationApi";

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchNotifications();
      setNotifications(response.notifications);
      setUnreadCount(response.unreadCount);
    } catch (err) {
      setError("Failed to load notifications");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      // Update local state optimistically
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Call API
      await markNotificationAsRead(notificationId);
    } catch (err) {
      console.error("Error marking notification as read:", err);
      // Revert on error
      loadNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
      setUnreadCount(0);
      await markAllNotificationsAsRead();
    } catch (err) {
      console.error("Error marking all as read:", err);
      loadNotifications();
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      const deletedNotif = notifications.find((n) => n.id === notificationId);
      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
      if (deletedNotif && !deletedNotif.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      await deleteNotification(notificationId);
    } catch (err) {
      console.error("Error deleting notification:", err);
      loadNotifications();
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.actionUrl) {
      // Navigate to the action URL if available
      window.location.href = notification.actionUrl;
    }
  };

  const filteredNotifications =
    filter === "unread"
      ? (notifications || []).filter((n) => !n.read)
      : notifications || [];

  return (
    <LawyerLayout
      pageSubtitle="View all your notifications"
      showBackButton={true}
      onBackClick={() => window.history.back()}
    >
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="mt-1 text-sm text-gray-600">
              You have <span className="font-semibold">{unreadCount}</span> unread notifications
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreferencesOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Preferences
            </button>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                <Check className="h-4 w-4" />
                Mark all as read
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 font-medium transition-colors ${
              filter === "all"
                ? "border-b-2 border-green-600 text-green-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            All ({notifications?.length || 0})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-4 py-2 font-medium transition-colors ${
              filter === "unread"
                ? "border-b-2 border-green-600 text-green-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button
              onClick={loadNotifications}
              className="ml-2 font-semibold underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg bg-gray-200"
              />
            ))}
          </div>
        )}

        {/* Notifications List */}
        {!loading && filteredNotifications.length === 0 && (
          <div className="rounded-lg bg-gray-50 p-8 text-center">
            <Trash2 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 font-medium text-gray-900">No notifications</h3>
            <p className="mt-1 text-sm text-gray-600">
              {filter === "unread"
                ? "You have read all your notifications"
                : "You don't have any notifications yet"}
            </p>
          </div>
        )}

        {!loading && filteredNotifications.length > 0 && (
          <div className="space-y-0">
            {filteredNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onRead={handleMarkAsRead}
                onDelete={handleDelete}
                onClick={handleNotificationClick}
              />
            ))}
          </div>
        )}
      </div>
      <NotificationPreferencesModal
        isOpen={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
      />
    </LawyerLayout>
  );
}
