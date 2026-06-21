import { getInMemoryAccessToken } from "../../modules/auth/utils/authStorage";

// =====================================================================
// Admin live notification client (WebSocket).
//
// The admin panel has no chat, so this is a lean, notifications-only client: it
// connects to the same /ws/chat server, authenticates with the in-memory access
// token, and listens for the server's "notification" push. On each push the
// listener (useLiveNotifications) refetches the admin notifications query, so the
// bell badge + center update instantly instead of waiting for the 30s poll.
//
// Messages are never SENT here — this is receive-only. Polling remains the
// fallback if the socket is down.
// =====================================================================

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

const WS_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ??
  `${API_URL.replace(/^http/, "ws").replace(/\/api\/?$/, "")}/ws/chat`;

export type NotificationSocketEvent = { type: "notification"; notification: unknown };

type Listener = (event: NotificationSocketEvent) => void;

class NotificationSocketManager {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Open the connection if it isn't already open/connecting. Safe to call often. */
  connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    const token = getInMemoryAccessToken();
    if (!token) {
      // Token not ready yet (e.g. right after reload, before the silent refresh
      // restores it). Retry on a backoff so the always-on bell listener connects
      // automatically once the token lands.
      this.scheduleReconnect();
      return;
    }

    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.onopen = () => {
      // The socket is actually up — clear any backoff accrued while waiting for
      // the token / retrying, so a later genuine drop reconnects promptly.
      this.reconnectAttempts = 0;
      const t = getInMemoryAccessToken();
      if (t) ws.send(JSON.stringify({ type: "auth", token: t }));
    };

    ws.onmessage = (ev) => {
      let data: unknown;
      try {
        data = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      const msg = data as { type?: string };

      if (msg.type === "auth_ok") {
        this.reconnectAttempts = 0;
        return;
      }
      if (msg.type === "auth_error") {
        return;
      }
      if (msg.type === "notification") {
        this.emit(data as NotificationSocketEvent);
      }
    };

    ws.onclose = () => {
      this.ws = null;
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    // Only keep retrying while someone is actually listening for notifications.
    if (this.listeners.size === 0) return;
    const delay = Math.min(30_000, 1000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    this.connect();
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Tear the connection down on logout so it isn't left authed as the previous
   * admin for whoever logs in next on the same tab (logout is an SPA route
   * change, no reload). The next login opens a fresh socket authed as the new
   * admin. Detaches handlers first so the intentional close doesn't reconnect.
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close(1000, "logout");
      } catch {
        /* already closing */
      }
    }
  }

  private emit(event: NotificationSocketEvent) {
    for (const listener of this.listeners) listener(event);
  }
}

export const notificationSocket = new NotificationSocketManager();
