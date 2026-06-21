import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  notificationSocket,
  type NotificationSocketEvent,
} from "../api/notificationSocket";

// Keep the admin notifications query live. Subscribes to the notification socket
// and, whenever the backend pushes a "notification" for this admin, invalidates
// the shared ["admin","notifications"] key so the sidebar badge + center refetch
// instantly (no 30s poll wait). Polling stays on as a fallback.
//
// Mount this once in an always-rendered place (AdminLayout) so the live layer
// stays connected across all admin pages.
export function useLiveNotifications() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const off = notificationSocket.on((event: NotificationSocketEvent) => {
      if (event.type === "notification") {
        queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
      }
    });
    return off;
  }, [queryClient]);
}
