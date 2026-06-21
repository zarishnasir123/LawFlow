import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bell,
  CheckCheck,
  Inbox,
  SlidersHorizontal,
  Trash2,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationActionPath,
  type AdminNotification,
} from "../api/notifications";
import NotificationPreferencesPanel from "../components/NotificationPreferencesPanel";

type NotificationFilter = "all" | "unread" | "read";
type View = "inbox" | "settings";

const formatTime = (isoDate: string) =>
  new Date(isoDate).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

// Map a notification `type` to a label + icon. Unknown types fall back to a
// generic bell so new backend notification types render gracefully.
function typeMeta(type: string): { label: string; icon: LucideIcon } {
  if (type.startsWith("payout")) return { label: "Payout", icon: Wallet };
  if (type === "lawyer_pending_verification")
    return { label: "Lawyer Verification", icon: BadgeCheck };
  return { label: "Notification", icon: Bell };
}

// Bucket notifications into Today / Yesterday / Earlier so a long list reads as
// sections instead of one wall of rows.
function groupByDate(items: AdminNotification[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;

  const today: AdminNotification[] = [];
  const yesterday: AdminNotification[] = [];
  const earlier: AdminNotification[] = [];
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

export default function Notifications() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [view, setView] = useState<View>("inbox");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: fetchNotifications,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const notifications = useMemo<AdminNotification[]>(
    () => data?.notifications ?? [],
    [data]
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: invalidate,
  });
  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: invalidate,
  });

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );
  const readCount = notifications.length - unreadCount;

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.isRead);
    if (filter === "read") return notifications.filter((n) => n.isRead);
    return notifications;
  }, [notifications, filter]);

  const groups = useMemo(() => groupByDate(filteredNotifications), [filteredNotifications]);

  const handleOpen = (notification: AdminNotification) => {
    if (!notification.isRead) markOneMutation.mutate(notification.id);
    const path = notificationActionPath(notification.type);
    if (path) navigate({ to: path });
  };

  return (
    <div className="w-full px-6 lg:px-8 xl:px-10 py-8 space-y-6">
      {/* Header */}
      <section className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#01411C]">Admin Notification Center</h1>
            <p className="mt-1 text-sm text-gray-600">
              {view === "settings"
                ? "Choose which admin events also email you. The center below always shows everything."
                : "Payout requests, new lawyers awaiting verification, and other admin events — all in one place."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setView((v) => (v === "settings" ? "inbox" : "settings"))}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              view === "settings"
                ? "border-[#01411C] bg-[#01411C] text-white hover:bg-[#025227]"
                : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {view === "settings" ? "Back to Inbox" : "Email Preferences"}
          </button>
        </div>

        {view === "inbox" && (
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
        )}
      </section>

      {view === "settings" ? (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <NotificationPreferencesPanel onSaved={() => setView("inbox")} />
        </section>
      ) : (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              {(["all", "unread", "read"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize ${
                    filter === f ? "bg-[#01411C] text-white" : "text-gray-600"
                  }`}
                >
                  {f} (
                  {f === "all"
                    ? notifications.length
                    : f === "unread"
                      ? unreadCount
                      : readCount}
                  )
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => markAllMutation.mutate()}
              disabled={unreadCount === 0 || markAllMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCheck className="h-4 w-4" />
              Mark All as Read
            </button>
          </div>

          <div className="mt-4">
            {isLoading ? (
              <div className="py-10 text-center text-gray-600">Loading notifications…</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
                <div className="rounded-full bg-gray-100 p-4">
                  <Inbox className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-gray-700">
                  No notifications {filter === "all" ? "yet" : `in "${filter}"`}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Payout requests and new lawyer registrations will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {groups.map((group) => (
                  <div key={group.label}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {group.label}
                    </p>
                    <div className="space-y-3">
                      {group.items.map((notification) => {
                        const meta = typeMeta(notification.type);
                        const Icon = meta.icon;
                        const clickable = Boolean(
                          notificationActionPath(notification.type)
                        );
                        return (
                          <article
                            key={notification.id}
                            onClick={
                              clickable ? () => handleOpen(notification) : undefined
                            }
                            className={`group rounded-lg border p-4 transition-shadow ${
                              clickable ? "cursor-pointer hover:shadow-sm" : ""
                            } ${
                              notification.isRead
                                ? "border-gray-200 bg-white"
                                : "border-emerald-200 bg-emerald-50/40"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className="rounded-lg border border-gray-200 bg-white p-2">
                                  <Icon className="h-4 w-4 text-[#01411C]" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-semibold text-gray-900">
                                      {notification.title}
                                    </h3>
                                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                                      {meta.label}
                                    </span>
                                    {!notification.isRead ? (
                                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                        New
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-sm text-gray-700">
                                    {notification.message}
                                  </p>
                                  <p className="mt-2 text-xs text-gray-500">
                                    {formatTime(notification.createdAt)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-1">
                                {!notification.isRead ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markOneMutation.mutate(notification.id);
                                    }}
                                    disabled={markOneMutation.isPending}
                                    className="rounded-md border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                                  >
                                    Mark Read
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteMutation.mutate(notification.id);
                                  }}
                                  disabled={deleteMutation.isPending}
                                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-60"
                                  aria-label="Delete notification"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
