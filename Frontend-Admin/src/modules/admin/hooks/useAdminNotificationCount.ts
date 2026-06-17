import { useQuery } from "@tanstack/react-query";

import { fetchNotifications } from "../api/notifications";

// Unread admin-notification count for the sidebar bell badge. Shares the
// ["admin", "notifications"] cache with the Notifications page, so reading one
// and the page reconcile off the same data; polls every 30s so a new payout
// request / lawyer registration shows up without a manual refresh.
export function useAdminNotificationCount(): number {
  const { data } = useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: fetchNotifications,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });
  return data?.unreadCount ?? 0;
}
