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
  | { type: "read"; conversationId: string; readAt: string };

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
    if (!token) return; // not logged in yet — a later subscribe()/on() retries

    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.onopen = () => {
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
        msg.type === "read"
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

  private emit(event: ChatSocketEvent) {
    for (const listener of this.listeners) listener(event);
  }
}

export const chatSocket = new ChatSocketManager();
