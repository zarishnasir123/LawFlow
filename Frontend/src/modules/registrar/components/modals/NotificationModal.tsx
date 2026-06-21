import { useMemo, useEffect, useState } from "react";
import { ArrowLeft, Bell, Inbox, SlidersHorizontal, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import NotificationCard from "../NotificationCard";
import NotificationPreferencesPanel from "./NotificationPreferencesPanel";
import type { Notification } from "../../types/notification";
import { useRegistrarNotifications } from "../../hooks/useRegistrarNotifications";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Bucket notifications into Today / Yesterday / Earlier.
function groupByDate(items: Notification[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;

  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const earlier: Notification[] = [];
  for (const n of items) {
    const t = new Date(n.createdAt).getTime();
    if (t >= startOfToday) today.push(n);
    else if (t >= startOfYesterday) yesterday.push(n);
    else earlier.push(n);
  }

  return [
    { label: "Today", items: today },
    { label: "Yesterday", items: yesterday },
    { label: "Earlier", items: earlier },
  ].filter((g) => g.items.length > 0);
}

// Registrar notification drawer. List view + an in-drawer Settings view (← Back)
// for the single "new case to review" email toggle — no center pop-up.
export default function NotificationModal({
  isOpen,
  onClose,
}: NotificationModalProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [view, setView] = useState<"list" | "settings">("list");
  const {
    notifications,
    unreadCount,
    isLoading,
    markRead,
    markAllRead,
    remove,
  } = useRegistrarNotifications();

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) markRead(notification.id);
    if (notification.actionUrl) {
      onClose();
      navigate({ to: notification.actionUrl });
    }
  };

  const allNotifications = useMemo(() => notifications || [], [notifications]);
  const filtered =
    filter === "unread" ? allNotifications.filter((n) => !n.read) : allNotifications;
  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-start sm:justify-end sm:p-6"
      onClick={onClose}
    >
      <div
        className={`flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${
          view === "list"
            ? "h-[85vh] max-h-[640px] sm:h-[640px]"
            : "max-h-[85vh] sm:max-h-[640px]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {view === "settings" ? (
          /* ----- Settings view (in-drawer, no center pop-up) ----- */
          <>
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                  aria-label="Back to notifications"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    Notification Preferences
                  </h2>
                  <p className="text-xs text-gray-500">Choose which emails you receive</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto">
              <NotificationPreferencesPanel onSaved={() => setView("list")} />
            </div>
          </>
        ) : (
          /* ----- List view ----- */
          <>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="relative rounded-xl bg-[#01411C]/10 p-2 text-[#01411C]">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
                  <p className="text-xs text-gray-500">
                    {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setView("settings")}
                  className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                  aria-label="Notification preferences"
                  title="Preferences"
                >
                  <SlidersHorizontal className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tabs + subtle mark-all-read */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5">
              <div className="flex gap-5">
                {(["all", "unread"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilter(tab)}
                    className={`-mb-px border-b-2 py-3 text-sm font-medium capitalize transition-colors ${
                      filter === tab
                        ? "border-[#01411C] text-[#01411C]"
                        : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {tab} ({tab === "all" ? allNotifications.length : unreadCount})
                  </button>
                ))}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead()}
                  className="text-xs font-medium text-gray-400 transition-colors hover:text-[#01411C]"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50 px-3 py-3">
              {isLoading ? (
                <div className="space-y-2 p-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200/70" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <div className="rounded-full bg-gray-100 p-4">
                    <Inbox className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-gray-700">
                    {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {filter === "unread"
                      ? "You've read everything — nice and tidy."
                      : "New case submissions and scheduling alerts will show up here."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groups.map((group) => (
                    <div key={group.label}>
                      <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        {group.label}
                      </p>
                      <div className="space-y-2">
                        {group.items.map((notification) => (
                          <NotificationCard
                            key={notification.id}
                            notification={notification}
                            onRead={markRead}
                            onDelete={remove}
                            onClick={handleNotificationClick}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
