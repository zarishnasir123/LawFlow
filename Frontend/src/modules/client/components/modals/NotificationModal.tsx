import { useState, useEffect } from "react";
import { X, Check, Trash2, SlidersHorizontal } from "lucide-react";
import NotificationCard from "../NotificationCard";
import NotificationPreferencesModal from "./NotificationPreferencesModal";
import type { Notification } from "../../types/notification";
import { useClientNotifications } from "../../hooks/useClientNotifications";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationModal({
  isOpen,
  onClose,
}: NotificationModalProps) {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    isLoading,
    markRead,
    markAllRead,
    deleteNotif,
  } = useClientNotifications();

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleMarkAsRead = (notificationId: string) => {
    markRead(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllRead();
  };

  const handleDelete = (notificationId: string) => {
    deleteNotif(notificationId);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const filteredNotifications =
    filter === "unread"
      ? (notifications || []).filter((n) => !n.read)
      : notifications || [];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/20 backdrop-blur-sm sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <NotificationPreferencesModal
        isOpen={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
      />
      <div
        className="h-[600px] w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
            <p className="text-xs text-gray-500">{unreadCount} unread</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreferencesOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Notification preferences"
              type="button"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Preferences
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1 hover:bg-gray-100 transition-colors"
              aria-label="Close"
              type="button"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-4 border-b border-gray-200 px-6 pt-3">
          <button
            onClick={() => setFilter("all")}
            className={`pb-3 text-sm font-medium transition-colors ${
              filter === "all"
                ? "border-b-2 border-green-600 text-green-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
            type="button"
          >
            All ({notifications?.length || 0})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`pb-3 text-sm font-medium transition-colors ${
              filter === "unread"
                ? "border-b-2 border-green-600 text-green-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
            type="button"
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Mark All as Read Button */}
        {unreadCount > 0 && (
          <div className="border-b border-gray-200 px-6 py-2">
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
              type="button"
            >
              <Check className="h-4 w-4" />
              Mark all as read
            </button>
          </div>
        )}

        {/* Notifications Content */}
        <div className="overflow-y-auto h-[calc(100%-180px)]">
          {isLoading && (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
              ))}
            </div>
          )}

          {!isLoading && filteredNotifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Trash2 className="h-10 w-10 text-gray-300" />
              <h3 className="mt-2 text-sm font-medium text-gray-600">No notifications</h3>
              <p className="text-xs text-gray-500 mt-1">
                {filter === "unread"
                  ? "You have read all your notifications"
                  : "You do not have any notifications yet"}
              </p>
            </div>
          )}

          {!isLoading && filteredNotifications.length > 0 && (
            <div className="px-4 py-3 space-y-2">
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
      </div>
    </div>
  );
}
