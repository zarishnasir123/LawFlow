import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Loader2,
  UserCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AdminNotification,
} from "../api/notifications";

type NotificationFilter = "all" | "unread" | "read";

const formatTime = (isoDate: string) =>
  new Date(isoDate).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

// Map a notification `type` to a label + icon. Unknown types fall back to a
// generic bell so new backend notification types render gracefully.
function typeMeta(type: string): { label: string; icon: LucideIcon } {
  if (type.startsWith("payout")) return { label: "Payout", icon: Wallet };
  if (type === "payment_received") return { label: "Payment", icon: Wallet };
  if (type === "lawyer_pending_verification")
    return { label: "Lawyer Verification", icon: UserCheck };
  return { label: "Notification", icon: Bell };
}

export default function Notifications() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotificationFilter>("all");

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

  return (
    <div className="w-full px-6 lg:px-8 xl:px-10 py-8 space-y-6">
      <section className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[#01411C]">Admin Notification Center</h1>
        <p className="mt-1 text-sm text-gray-600">
          Payout requests, new lawyers awaiting verification, and other admin
          events — all in one place.
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
            {markAllMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            Mark All as Read
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {isLoading ? (
            <div className="py-10 text-center text-gray-600">Loading notifications…</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-gray-600">
              No notifications {filter === "all" ? "yet" : `in "${filter}"`}.
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const meta = typeMeta(notification.type);
              const Icon = meta.icon;
              return (
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
                      <div className="rounded-lg border border-gray-200 bg-white p-2">
                        <Icon className="h-4 w-4 text-[#01411C]" />
                      </div>
                      <div>
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
                        <p className="mt-1 text-sm text-gray-700">{notification.message}</p>
                        <p className="mt-2 text-xs text-gray-500">
                          {formatTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>

                    {!notification.isRead ? (
                      <button
                        type="button"
                        onClick={() => markOneMutation.mutate(notification.id)}
                        disabled={markOneMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark Read
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
