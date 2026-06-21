import { getInMemoryAccessToken } from "../../modules/auth/utils/authStorage";
import type { ChatMessage } from "../../types/chat";

// =====================================================================
// Chat live client (WebSocket).
//
// A single shared connection for the whole app. It authenticates with the
// in-memory access token, auto-reconnects with backoff, and lets screens
// subscribe to a conversation and listen for incoming messages / typing /
// presence. Messages are still SENT over REST — this only receives the live
// push + relays typing.
// =====================================================================

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

// Derive ws://host/ws/chat from the REST base (http://host/api) unless an
// explicit VITE_WS_URL is provided.
const WS_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ??
  `${API_URL.replace(/^http/, "ws").replace(/\/api\/?$/, "")}/ws/chat`;

export type ChatSocketEvent =
  | { type: "message"; conversationId: string; message: ChatMessage }
  | { type: "message_update"; conversationId: string; message: ChatMessage }
  | { type: "typing"; conversationId: string; from: string; isTyping: boolean }
  | { type: "presence"; userId: string; online: boolean }
  | { type: "read"; conversationId: string; readAt: string }
  // A new in-app notification was created for this user. The payload is just a
  // signal — listeners refetch their notifications query rather than trusting
  // the shape — so the bell/list update instantly without polling.
  | { type: "notification"; notification: unknown };

type Listener = (event: ChatSocketEvent) => void;

class ChatSocketManager {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private subscriptions = new Set<string>();
  private authed = false;
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
      // Token not ready yet (e.g. right after a page reload, before the silent
      // refresh restores it). Retry on a backoff so an always-on listener (the
      // notification bell) connects automatically once the token lands — instead
      // of staying dead until the next manual subscribe()/on().
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
        this.authed = true;
        this.reconnectAttempts = 0;
        // (Re)subscribe to everything the UI currently cares about.
        for (const id of this.subscriptions) {
          this.rawSend({ type: "subscribe", conversationId: id });
        }
        return;
      }
      if (msg.type === "auth_error") {
        this.authed = false;
        return;
      }
      if (
        msg.type === "message" ||
        msg.type === "message_update" ||
        msg.type === "typing" ||
        msg.type === "presence" ||
        msg.type === "read" ||
        msg.type === "notification"
      ) {
        this.emit(data as ChatSocketEvent);
      }
    };

    ws.onclose = () => {
      this.authed = false;
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
    // Only reconnect if something still needs the socket.
    if (this.subscriptions.size === 0 && this.listeners.size === 0) return;
    const delay = Math.min(30_000, 1000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private rawSend(obj: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  subscribe(conversationId: string) {
    this.subscriptions.add(conversationId);
    this.connect();
    if (this.authed) this.rawSend({ type: "subscribe", conversationId });
  }

  unsubscribe(conversationId: string) {
    this.subscriptions.delete(conversationId);
    // Tell the server we've stopped viewing this chat (so it knows to send a
    // bell notification for future messages).
    this.rawSend({ type: "unsubscribe", conversationId });
  }

  sendTyping(conversationId: string, isTyping: boolean) {
    this.rawSend({ type: "typing", conversationId, isTyping });
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    this.connect();
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Tear the connection down on logout. Without this the singleton's open,
   * server-authenticated socket survives a same-tab logout (SPA route change,
   * no reload) and stays bound to the PREVIOUS user — so the next user's live
   * layer silently breaks and the previous user's pushes land in their tab.
   * Closing it here means the next login opens a fresh socket authed as the new
   * user. Detaches handlers first so the intentional close doesn't auto-reconnect.
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.subscriptions.clear();
    this.authed = false;
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

  private emit(event: ChatSocketEvent) {
    for (const listener of this.listeners) listener(event);
  }
}

export const chatSocket = new ChatSocketManager();
