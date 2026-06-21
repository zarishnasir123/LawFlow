import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { chatSocket, type ChatSocketEvent } from "../api/chatSocket";

// Keep a role's notifications query live. Subscribes to the shared socket and,
// whenever the backend pushes a "notification" event for this user, invalidates
// the given query key so the bell badge + list refetch instantly (no 30s poll
// wait). Polling stays on as a fallback for when the socket is down.
//
// Calling chatSocket.on() opens (and keeps open) the connection, so this also
// brings the live layer online for roles that don't use chat (e.g. registrar).
export function useLiveNotifications(queryKey: readonly unknown[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const off = chatSocket.on((event: ChatSocketEvent) => {
      if (event.type === "notification") {
        queryClient.invalidateQueries({ queryKey });
      }
    });
    return off;
  }, [queryClient, queryKey]);
}
