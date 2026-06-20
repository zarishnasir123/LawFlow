import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  deleteNotification,
} from "../api/notificationApi";
import type { NotificationResponse } from "../types/notification";

export const CLIENT_NOTIFICATIONS_KEY = ["client", "notifications"] as const;

const REFETCH_INTERVAL_MS = 30_000;

export function useClientNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery<NotificationResponse>({
    queryKey: CLIENT_NOTIFICATIONS_KEY,
    queryFn: fetchNotifications,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  const markRead = useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(notificationId),
    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey: CLIENT_NOTIFICATIONS_KEY });
      const previous = queryClient.getQueryData<NotificationResponse>(CLIENT_NOTIFICATIONS_KEY);
      if (previous) {
        const target = previous.notifications.find((n) => n.id === notificationId);
        const wasUnread = target ? !target.read : false;
        queryClient.setQueryData<NotificationResponse>(CLIENT_NOTIFICATIONS_KEY, {
          notifications: previous.notifications.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          ),
          unreadCount: wasUnread
            ? Math.max(0, previous.unreadCount - 1)
            : previous.unreadCount,
        });
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CLIENT_NOTIFICATIONS_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_NOTIFICATIONS_KEY });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: CLIENT_NOTIFICATIONS_KEY });
      const previous = queryClient.getQueryData<NotificationResponse>(CLIENT_NOTIFICATIONS_KEY);
      if (previous) {
        queryClient.setQueryData<NotificationResponse>(CLIENT_NOTIFICATIONS_KEY, {
          notifications: previous.notifications.map((n) => ({
            ...n,
            read: true,
          })),
          unreadCount: 0,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CLIENT_NOTIFICATIONS_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_NOTIFICATIONS_KEY });
    },
  });

  const deleteNotif = useMutation({
    mutationFn: (notificationId: string) => deleteNotification(notificationId),
    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey: CLIENT_NOTIFICATIONS_KEY });
      const previous = queryClient.getQueryData<NotificationResponse>(CLIENT_NOTIFICATIONS_KEY);
      if (previous) {
        const target = previous.notifications.find((n) => n.id === notificationId);
        const wasUnread = target ? !target.read : false;
        queryClient.setQueryData<NotificationResponse>(CLIENT_NOTIFICATIONS_KEY, {
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
        queryClient.setQueryData(CLIENT_NOTIFICATIONS_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_NOTIFICATIONS_KEY });
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
    deleteNotif: deleteNotif.mutate,
  };
}
