import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import {
  getChatAttachmentSignedUrl,
  uploadChatAttachment,
} from "../../services/storage.service.js";

// =====================================================================
// Chat — one-to-one messaging between a CLIENT and a LAWYER.
//
// A conversation is a (client, lawyer) PAIR, independent of any case. A
// client finds a lawyer in the directory and starts a conversation; the
// lawyer sees it in their inbox and replies. There is exactly one
// conversation per pair.
//
// Authorization is enforced by assertConversationParticipant() on EVERY
// read and write: the caller must be the conversation's client_user_id or
// its lawyer_user_id, established straight off the conversation row — never
// trusted from the request. All SQL is parameterised.
// =====================================================================

// Two-letter avatar initials for the chat UI (e.g. "Ahmed Khan" -> "AK").
function initialsFor(name) {
  if (!name || typeof name !== "string") return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// "last message" preview for the inbox; attachments get a label instead of
// (empty) text.
function previewFor(row) {
  if (!row || !row.message_kind) return "";
  if (row.message_kind === "file") return "📎 Document";
  if (row.message_kind === "voice") return "🎤 Voice message";
  return row.body || "";
}

// Map a chat_messages row to the frontend ChatMessage shape. `sender` is
// derived relative to the conversation's lawyer: the lawyer's messages are
// "lawyer", everything else (including a deleted sender) is "client".
function mapMessage(row, lawyerUserId) {
  return {
    id: row.id,
    threadId: row.conversation_id,
    sender: row.sender_user_id === lawyerUserId ? "lawyer" : "client",
    text: row.body || "",
    kind: row.message_kind,
    attachmentName: row.attachment_name || null,
    attachmentMime: row.attachment_mime || null,
    attachmentSize:
      row.attachment_size === null || row.attachment_size === undefined
        ? null
        : Number(row.attachment_size),
    // Filled in by the controller via a signed URL (Chunk 2); the storage
    // path itself is never sent to the browser.
    attachmentUrl: null,
    voiceDurationSeconds:
      row.voice_duration_seconds === null ||
      row.voice_duration_seconds === undefined
        ? null
        : Number(row.voice_duration_seconds),
    createdAt: row.created_at,
  };
}

function fullName(first, last, fallback) {
  const name = `${first || ""} ${last || ""}`.trim();
  return name || fallback;
}

// Mint short-lived signed download URLs for any attachment messages, in
// place. `messages` and `rows` are index-aligned (rows hold the storage
// path, which we never expose directly).
async function enrichWithSignedUrls(messages, rows) {
  await Promise.all(
    messages.map(async (msg, i) => {
      const path = rows[i]?.attachment_storage_path;
      if (path) {
        msg.attachmentUrl = await getChatAttachmentSignedUrl(path);
      }
    })
  );
  return messages;
}

// Resolve who the caller is in this conversation and who they're talking to,
// or throw. Returns:
//   { conversationId, role: 'lawyer'|'client',
//     clientUserId, lawyerUserId,
//     counterpart: { id, name, initials } }
// 404 when the conversation doesn't exist OR the caller isn't a participant
// (we don't distinguish, so we never leak a conversation's existence).
export async function assertConversationParticipant(conversationId, userId) {
  const result = await pool.query(
    `SELECT
       conv.id,
       conv.client_user_id,
       conv.lawyer_user_id,
       cu.first_name AS client_first,
       cu.last_name  AS client_last,
       lu.first_name AS lawyer_first,
       lu.last_name  AS lawyer_last
     FROM chat_conversations conv
     JOIN users cu ON cu.id = conv.client_user_id
     JOIN users lu ON lu.id = conv.lawyer_user_id
     WHERE conv.id = $1`,
    [conversationId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new ApiError(404, "Conversation not found");
  }

  const clientName = fullName(row.client_first, row.client_last, "Client");
  const lawyerName = fullName(row.lawyer_first, row.lawyer_last, "Advocate");

  if (userId === row.client_user_id) {
    return {
      conversationId: row.id,
      role: "client",
      clientUserId: row.client_user_id,
      lawyerUserId: row.lawyer_user_id,
      counterpart: {
        id: row.lawyer_user_id,
        name: lawyerName,
        initials: initialsFor(lawyerName),
      },
    };
  }

  if (userId === row.lawyer_user_id) {
    return {
      conversationId: row.id,
      role: "lawyer",
      clientUserId: row.client_user_id,
      lawyerUserId: row.lawyer_user_id,
      counterpart: {
        id: row.client_user_id,
        name: clientName,
        initials: initialsFor(clientName),
      },
    };
  }

  throw new ApiError(404, "Conversation not found");
}

// Client-initiated: find (or create) the conversation between this client and
// the given lawyer. Validates the target is a real lawyer account. Returns the
// conversation header from the client's perspective (counterpart = lawyer).
export async function startConversationForClient({ clientUserId, lawyerUserId }) {
  if (clientUserId === lawyerUserId) {
    throw new ApiError(400, "You cannot start a conversation with yourself");
  }

  const lawyer = await pool.query(
    `SELECT u.id, u.first_name, u.last_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1 AND r.name = 'lawyer'`,
    [lawyerUserId]
  );
  if (lawyer.rowCount === 0) {
    throw new ApiError(404, "Lawyer not found");
  }

  // Idempotent: the UNIQUE(client, lawyer) constraint means a repeat "Message"
  // click returns the same conversation rather than erroring. The no-op
  // DO UPDATE is what lets RETURNING surface the existing row.
  const upsert = await pool.query(
    `INSERT INTO chat_conversations (client_user_id, lawyer_user_id)
     VALUES ($1, $2)
     ON CONFLICT (client_user_id, lawyer_user_id)
       DO UPDATE SET updated_at = chat_conversations.updated_at
     RETURNING id, created_at, updated_at`,
    [clientUserId, lawyerUserId]
  );

  const conv = upsert.rows[0];
  const lawyerName = fullName(
    lawyer.rows[0].first_name,
    lawyer.rows[0].last_name,
    "Advocate"
  );

  return {
    id: conv.id,
    counterpart: {
      id: lawyerUserId,
      name: lawyerName,
      initials: initialsFor(lawyerName),
      status: "offline",
    },
    lastMessage: "",
    lastMessageAt: conv.updated_at,
    unreadCount: 0,
  };
}

// The inbox: every conversation the caller can see, with the other person's
// name, a last-message preview, last-message time, and the caller's unread
// count. A client sees every conversation they started; a lawyer sees only
// conversations that have at least one message (so a client opening — but
// never messaging — doesn't create a ghost entry in the lawyer's inbox).
//
// `status` (online/offline) is "offline" for now — it becomes real once the
// live presence layer lands in Chunk 3.
export async function listConversationsForUser({ userId, role }) {
  if (role !== "lawyer" && role !== "client") {
    return [];
  }

  const counterpartIdCol =
    role === "client" ? "conv.lawyer_user_id" : "conv.client_user_id";

  const whereClause =
    role === "client"
      ? "conv.client_user_id = $1"
      : `conv.lawyer_user_id = $1
         AND EXISTS (SELECT 1 FROM chat_messages m2 WHERE m2.conversation_id = conv.id)`;

  const fallbackName = role === "client" ? "Advocate" : "Client";

  const sql = `
    SELECT
      conv.id AS conversation_id,
      conv.updated_at,
      other.id AS counterpart_id,
      TRIM(other.first_name || ' ' || other.last_name) AS counterpart_name,
      lm.body AS last_body,
      lm.message_kind AS last_kind,
      lm.created_at AS last_message_at,
      COALESCE(uc.unread, 0) AS unread_count
    FROM chat_conversations conv
    JOIN users other ON other.id = ${counterpartIdCol}
    LEFT JOIN LATERAL (
      SELECT body, message_kind, created_at
      FROM chat_messages m
      WHERE m.conversation_id = conv.id
      ORDER BY m.created_at DESC
      LIMIT 1
    ) lm ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS unread
      FROM chat_messages m
      LEFT JOIN chat_reads r
        ON r.conversation_id = m.conversation_id AND r.user_id = $1
      WHERE m.conversation_id = conv.id
        AND (m.sender_user_id IS NULL OR m.sender_user_id <> $1)
        AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
    ) uc ON TRUE
    WHERE ${whereClause}
    ORDER BY COALESCE(lm.created_at, conv.updated_at) DESC
  `;

  const { rows } = await pool.query(sql, [userId]);

  return rows.map((row) => {
    const name = (row.counterpart_name || "").trim() || fallbackName;
    return {
      id: row.conversation_id,
      counterpart: {
        id: row.counterpart_id,
        name,
        initials: initialsFor(name),
        status: "offline",
      },
      lastMessage: previewFor({ body: row.last_body, message_kind: row.last_kind }),
      lastMessageAt: row.last_message_at || row.updated_at,
      unreadCount: Number(row.unread_count) || 0,
    };
  });
}

// Header info for a single conversation (opening a chat directly by id).
export async function getConversationHeader({ conversationId, userId }) {
  const participant = await assertConversationParticipant(conversationId, userId);
  return {
    id: participant.conversationId,
    counterpart: { ...participant.counterpart, status: "offline" },
  };
}

// Full message history for a conversation, oldest-first.
export async function listMessages({ conversationId, userId }) {
  const participant = await assertConversationParticipant(conversationId, userId);

  const { rows } = await pool.query(
    `SELECT id, conversation_id, sender_user_id, message_kind, body,
            attachment_storage_path, attachment_name, attachment_mime,
            attachment_size, voice_duration_seconds, created_at
     FROM chat_messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId]
  );

  const messages = rows.map((row) => mapMessage(row, participant.lawyerUserId));
  await enrichWithSignedUrls(messages, rows);

  return { participant, messages, rows };
}

// Persist a text message from the caller and bump the conversation's
// last-activity time. Returns the mapped ChatMessage + the participant.
export async function createTextMessage({ conversationId, userId, body }) {
  const participant = await assertConversationParticipant(conversationId, userId);

  const text = (body || "").trim();
  if (!text) {
    throw new ApiError(400, "Message text is required");
  }

  const { rows } = await pool.query(
    `INSERT INTO chat_messages (conversation_id, sender_user_id, message_kind, body)
     VALUES ($1, $2, 'text', $3)
     RETURNING id, conversation_id, sender_user_id, message_kind, body,
               attachment_storage_path, attachment_name, attachment_mime,
               attachment_size, voice_duration_seconds, created_at`,
    [conversationId, userId, text]
  );

  await pool.query(
    `UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1`,
    [conversationId]
  );

  return {
    participant,
    message: mapMessage(rows[0], participant.lawyerUserId),
  };
}

// Persist a file or voice message: upload the bytes to storage, then insert
// the row (so a failed upload never leaves an orphan row). Returns the mapped
// ChatMessage with a fresh signed download URL + the participant.
export async function createAttachmentMessage({
  conversationId,
  userId,
  file,
  kind,
  voiceDurationSeconds,
}) {
  const participant = await assertConversationParticipant(conversationId, userId);

  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new ApiError(400, "No file uploaded");
  }

  const messageKind = kind === "voice" ? "voice" : "file";

  // Pre-generate the message id so the storage path can embed it and the DB
  // row is only inserted AFTER the upload succeeds.
  const idResult = await pool.query("SELECT gen_random_uuid() AS id");
  const messageId = idResult.rows[0].id;

  const { storagePath } = await uploadChatAttachment({
    conversationId,
    messageId,
    fileBuffer: file.buffer,
    mimeType: file.mimetype,
    originalName: file.originalname,
  });

  const duration =
    messageKind === "voice" && Number.isFinite(Number(voiceDurationSeconds))
      ? Math.max(0, Math.round(Number(voiceDurationSeconds)))
      : null;

  const baseMime = (file.mimetype || "").split(";")[0].trim() || null;

  const { rows } = await pool.query(
    `INSERT INTO chat_messages
       (id, conversation_id, sender_user_id, message_kind, body,
        attachment_storage_path, attachment_name, attachment_mime,
        attachment_size, voice_duration_seconds)
     VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, $9)
     RETURNING id, conversation_id, sender_user_id, message_kind, body,
               attachment_storage_path, attachment_name, attachment_mime,
               attachment_size, voice_duration_seconds, created_at`,
    [
      messageId,
      conversationId,
      userId,
      messageKind,
      storagePath,
      file.originalname || null,
      baseMime,
      Number.isFinite(file.size) ? file.size : null,
      duration,
    ]
  );

  await pool.query(
    `UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1`,
    [conversationId]
  );

  const message = mapMessage(rows[0], participant.lawyerUserId);
  message.attachmentUrl = await getChatAttachmentSignedUrl(storagePath);

  return { participant, message };
}

// Mark the conversation read up to "now" for the caller. Drives unread badges
// + the other party's seen tick.
export async function markConversationRead({ conversationId, userId }) {
  await assertConversationParticipant(conversationId, userId);

  await pool.query(
    `INSERT INTO chat_reads (conversation_id, user_id, last_read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (conversation_id, user_id)
     DO UPDATE SET last_read_at = NOW()`,
    [conversationId, userId]
  );

  return { read: true };
}
