import { WebSocketServer } from "ws";

import { verifyAccessToken } from "../utils/tokens.js";
import { assertConversationParticipant } from "../modules/chat/chat.service.js";

// =====================================================================
// Chat live layer (WebSocket).
//
// One WebSocketServer mounted at /ws/chat on the same HTTP server as the
// REST API. It does NOT carry the messages themselves — messages are saved
// over normal REST so they're durable even if the socket is down. This layer
// only PUSHES already-saved messages to the other participant instantly, and
// relays the ephemeral signals: "typing…" and online/offline presence.
//
// Auth: the browser sends { type:"auth", token } as its first frame; we
// verify it with the same verifyAccessToken used by the REST middleware and
// remember which user the connection belongs to. Per-conversation access is
// re-checked with assertConversationParticipant on every subscribe/typing.
// =====================================================================

// userId -> Set<ws>. A user can have several tabs/devices open.
const userSockets = new Map();

function addSocket(userId, ws) {
  let set = userSockets.get(userId);
  if (!set) {
    set = new Set();
    userSockets.set(userId, set);
  }
  set.add(ws);
}

function removeSocket(userId, ws) {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) userSockets.delete(userId);
}

export function isUserOnline(userId) {
  const set = userSockets.get(userId);
  return Boolean(set && set.size > 0);
}

function sendToSocket(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function sendToUser(userId, payload) {
  const set = userSockets.get(userId);
  if (!set) return;
  for (const ws of set) sendToSocket(ws, payload);
}

// Tell everyone currently connected that a user went online/offline. At FYP
// scale this fan-out is fine; the frontend simply ignores presence for users
// it isn't currently looking at.
function broadcastPresence(userId, online) {
  const payload = { type: "presence", userId, online };
  for (const [, set] of userSockets) {
    for (const ws of set) sendToSocket(ws, payload);
  }
}

// Called by the REST controller AFTER a message is persisted — pushes it live
// to both participants (the sender's own tab de-dupes by message id).
export function pushMessageToConversation({
  clientUserId,
  lawyerUserId,
  conversationId,
  message,
}) {
  const payload = { type: "message", conversationId, message };
  sendToUser(clientUserId, payload);
  sendToUser(lawyerUserId, payload);
}

// Push a "seen" receipt to a user — their messages up to readAt are now read
// by the other party (drives the ✓✓ tick live).
export function pushReadReceipt({ toUserId, conversationId, readAt }) {
  sendToUser(toUserId, { type: "read", conversationId, readAt });
}

// Push an UPDATED message (e.g. edited) to both participants so they replace
// the existing one in place.
export function pushMessageUpdate({
  clientUserId,
  lawyerUserId,
  conversationId,
  message,
}) {
  const payload = { type: "message_update", conversationId, message };
  sendToUser(clientUserId, payload);
  sendToUser(lawyerUserId, payload);
}

// Is the user actively looking at this conversation right now? True if any of
// their sockets has it as the active (subscribed) conversation. Used to decide
// whether a bell notification is needed (skip it while they're watching).
export function isUserViewingConversation(userId, conversationId) {
  const set = userSockets.get(userId);
  if (!set) return false;
  for (const ws of set) {
    if (ws.activeConversationId === conversationId) return true;
  }
  return false;
}

// Mirror app.js's CORS origin policy for the WS upgrade (helmet/cors don't run
// on upgrades). Fail-closed in production, allow localhost in dev.
function resolveAllowedOrigins() {
  const envList = process.env.FRONTEND_URLS?.trim();
  if (envList) return envList.split(",").map((s) => s.trim()).filter(Boolean);
  const envSingle = process.env.FRONTEND_URL?.trim();
  if (envSingle) return [envSingle];
  if (process.env.NODE_ENV === "production") return [];
  return ["http://localhost:5173", "http://localhost:5174"];
}

const AUTH_TIMEOUT_MS = 10_000;

export function initChatSocket(server) {
  const allowedOrigins = resolveAllowedOrigins();

  const wss = new WebSocketServer({
    server,
    path: "/ws/chat",
    verifyClient: (info, done) => {
      const origin = info.origin;
      // No Origin header (e.g. a non-browser client) is allowed; a present
      // Origin must be in the allowlist.
      if (!origin || allowedOrigins.includes(origin)) return done(true);
      return done(false, 403, "Origin not allowed");
    },
  });

  wss.on("connection", (ws) => {
    ws.isAuthed = false;
    ws.userId = null;
    ws.activeConversationId = null;

    // Drop connections that never authenticate.
    const authTimer = setTimeout(() => {
      if (!ws.isAuthed) {
        try {
          ws.close(4001, "Auth timeout");
        } catch {
          /* already closing */
        }
      }
    }, AUTH_TIMEOUT_MS);

    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      // ---- auth handshake (first frame) -------------------------------
      if (msg.type === "auth") {
        try {
          const payload = verifyAccessToken(msg.token);
          ws.userId = payload.sub;
          ws.role = payload.role;
          ws.isAuthed = true;
          clearTimeout(authTimer);

          const wasOffline = !isUserOnline(ws.userId);
          addSocket(ws.userId, ws);
          sendToSocket(ws, { type: "auth_ok" });
          // Only announce "online" on the first socket for this user.
          if (wasOffline) broadcastPresence(ws.userId, true);
        } catch {
          sendToSocket(ws, { type: "auth_error" });
          try {
            ws.close(4002, "Invalid token");
          } catch {
            /* already closing */
          }
        }
        return;
      }

      if (!ws.isAuthed) return;

      // ---- subscribe to a conversation --------------------------------
      // We use it to hand back the counterpart's current presence; the actual
      // message delivery is by-user, so no server-side room is required.
      if (msg.type === "subscribe" && msg.conversationId) {
        try {
          const participant = await assertConversationParticipant(
            msg.conversationId,
            ws.userId
          );
          // Remember which conversation this socket is viewing (one at a time)
          // so the bell logic can tell whether to notify.
          ws.activeConversationId = msg.conversationId;
          sendToSocket(ws, {
            type: "presence",
            userId: participant.counterpart.id,
            online: isUserOnline(participant.counterpart.id),
          });
        } catch {
          /* not a participant — ignore silently */
        }
        return;
      }

      // ---- leave a conversation (stop "viewing" it) -------------------
      if (msg.type === "unsubscribe" && msg.conversationId) {
        if (ws.activeConversationId === msg.conversationId) {
          ws.activeConversationId = null;
        }
        return;
      }

      // ---- typing relay -----------------------------------------------
      if (msg.type === "typing" && msg.conversationId) {
        try {
          const participant = await assertConversationParticipant(
            msg.conversationId,
            ws.userId
          );
          sendToUser(participant.counterpart.id, {
            type: "typing",
            conversationId: msg.conversationId,
            from: ws.userId,
            isTyping: Boolean(msg.isTyping),
          });
        } catch {
          /* not a participant — ignore */
        }
        return;
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimer);
      if (ws.userId) {
        removeSocket(ws.userId, ws);
        if (!isUserOnline(ws.userId)) broadcastPresence(ws.userId, false);
      }
    });

    ws.on("error", () => {
      /* swallow — close handler does the cleanup */
    });
  });

  console.log("Chat WebSocket server listening on /ws/chat");
  return wss;
}