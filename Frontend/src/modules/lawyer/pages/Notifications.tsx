import { useState } from "react";
import { Check, Trash2, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import LawyerLayout from "../components/LawyerLayout";
import NotificationCard from "../components/NotificationCard";
import NotificationPreferencesModal from "../components/modals/NotificationPreferencesModal";
import type { Notification } from "../types/notification";
import { useLawyerNotifications } from "../hooks/useLawyerNotifications";

export default function Notifications() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  // Live data + mutations from the shared 30s-polling hook. Same source the
  // bell badge reads, so the page and the badge stay in lockstep.
  const {
    notifications,
    unreadCount,
    isLoading,
    isError,
    refetch,
    markRead,
    markAllRead,
  } = useLawyerNotifications();

  const handleMarkAsRead = (notificationId: string) => {
    markRead(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllRead();
  };

  // Clicking a notification card marks it read (the card calls onRead for
  // unread rows) and, when it references a case, opens that case.
  const handleNotificationClick = (notification: Notification) => {
    if (notification.caseId) {
      navigate({ to: `/lawyer-case-editor/${notification.caseId}` });
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
        {isError && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            Failed to load notifications
            <button
              onClick={() => refetch()}
              className="ml-2 font-semibold underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
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
        {!isLoading && filteredNotifications.length === 0 && (
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

        {!isLoading && filteredNotifications.length > 0 && (
          <div className="space-y-0">
            {filteredNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onRead={handleMarkAsRead}
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
