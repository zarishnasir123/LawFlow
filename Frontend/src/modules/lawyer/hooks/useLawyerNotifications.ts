import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../api/notificationApi";
import type { NotificationResponse } from "../types/notification";

// Shared query key for the lawyer's live notifications. Both the bell badge
// (LawyerLayout) and the dropdown/page read from this single cache entry, so
// marking one read in the modal updates the badge instantly.
export const LAWYER_NOTIFICATIONS_KEY = ["lawyer", "notifications"] as const;

// Poll every 30s so newly-created notifications (e.g. a registrar accepting /
// returning a case) and the unread badge appear without a manual refresh.
const REFETCH_INTERVAL_MS = 30_000;

// Reads GET /api/notifications on an interval. Returns the live notification
// list + unreadCount plus the mutations the UI needs. Mounting this in more
// than one place (layout badge + modal) is cheap: TanStack Query dedupes on
// the shared key, so there's a single in-flight request and one poll loop.
export function useLawyerNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery<NotificationResponse>({
    queryKey: LAWYER_NOTIFICATIONS_KEY,
    queryFn: fetchNotifications,
    refetchInterval: REFETCH_INTERVAL_MS,
    // Keep polling even when the tab is backgrounded so the badge is fresh
    // the moment the lawyer returns.
    refetchIntervalInBackground: true,
  });

  const markRead = useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationAsRead(notificationId),
    // Optimistically flip the row + decrement the badge so the click feels
    // instant; reconcile against the server on settle.
    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey: LAWYER_NOTIFICATIONS_KEY });
      const previous = queryClient.getQueryData<NotificationResponse>(
        LAWYER_NOTIFICATIONS_KEY
      );
      if (previous) {
        const target = previous.notifications.find(
          (n) => n.id === notificationId
        );
        const wasUnread = target ? !target.read : false;
        queryClient.setQueryData<NotificationResponse>(
          LAWYER_NOTIFICATIONS_KEY,
          {
            notifications: previous.notifications.map((n) =>
              n.id === notificationId ? { ...n, read: true } : n
            ),
            unreadCount: wasUnread
              ? Math.max(0, previous.unreadCount - 1)
              : previous.unreadCount,
          }
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(LAWYER_NOTIFICATIONS_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: LAWYER_NOTIFICATIONS_KEY });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: LAWYER_NOTIFICATIONS_KEY });
      const previous = queryClient.getQueryData<NotificationResponse>(
        LAWYER_NOTIFICATIONS_KEY
      );
      if (previous) {
        queryClient.setQueryData<NotificationResponse>(
          LAWYER_NOTIFICATIONS_KEY,
          {
            notifications: previous.notifications.map((n) => ({
              ...n,
              read: true,
            })),
            unreadCount: 0,
          }
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(LAWYER_NOTIFICATIONS_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: LAWYER_NOTIFICATIONS_KEY });
    },
  });

  const remove = useMutation({
    mutationFn: (notificationId: string) => deleteNotification(notificationId),
    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey: LAWYER_NOTIFICATIONS_KEY });
      const previous = queryClient.getQueryData<NotificationResponse>(
        LAWYER_NOTIFICATIONS_KEY
      );
      if (previous) {
        const target = previous.notifications.find((n) => n.id === notificationId);
        const wasUnread = target ? !target.read : false;
        queryClient.setQueryData<NotificationResponse>(LAWYER_NOTIFICATIONS_KEY, {
          notifications: previous.notifications.filter((n) => n.id !== notificationId),
          unreadCount: wasUnread
            ? Math.max(0, previous.unreadCount - 1)
            : previous.unreadCount,
        });
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(LAWYER_NOTIFICATIONS_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: LAWYER_NOTIFICATIONS_KEY });
    },
  });

  return {
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
    remove: remove.mutate,
  };
}
