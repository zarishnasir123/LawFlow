import { ApiError } from "../../utils/apiError.js";
import {
  isUserViewingConversation,
  pushMessageToConversation,
  pushReadReceipt,
} from "../../realtime/chatSocket.js";
import { createNotification } from "../notifications/notifications.service.js";
import {
  createAttachmentMessage,
  createTextMessage,
  getConversationHeader,
  listConversationsForUser,
  listMessages,
  markConversationRead,
  startConversationForClient,
} from "./chat.service.js";

// Short preview used in the bell notification.
function previewOf(message) {
  if (message.kind === "file") return "📎 Document";
  if (message.kind === "voice") return "🎤 Voice message";
  return message.text || "New message";
}

// After a message is saved: push it live to both participants, and — if the
// recipient ISN'T currently looking at this chat — drop a bell notification so
// they notice. All best-effort: a socket/notification hiccup must never fail
// the REST request that already durably saved the message.
async function deliverMessage(participant, message) {
  try {
    pushMessageToConversation({
      clientUserId: participant.clientUserId,
      lawyerUserId: participant.lawyerUserId,
      conversationId: participant.conversationId,
      message,
    });
  } catch (err) {
    console.error("[chat] live push failed:", err?.message);
  }

  const recipientId = participant.counterpart.id;
  if (!isUserViewingConversation(recipientId, participant.conversationId)) {
    try {
      await createNotification({
        userId: recipientId,
        type: "chat_message",
        title: "New message",
        message: previewOf(message),
      });
    } catch (err) {
      console.error("[chat] bell notification failed:", err?.message);
    }
  }
}

// req.user.sub is the caller's user id and req.user.role their role (from the
// JWT — see issueSessionTokens in auth.service.js). Every handler scopes its
// work to that identity; the service's assertConversationParticipant guard is
// the authoritative check that the caller belongs to the conversation.

// GET /api/chat/conversations -> { conversations }
export async function listMyConversations(req, res) {
  const conversations = await listConversationsForUser({
    userId: req.user.sub,
    role: req.user.role,
  });
  return res.status(200).json({ conversations });
}

// POST /api/chat/conversations -> { conversation }
// Client-only: start (or reopen) a conversation with a lawyer from the
// directory. Body: { lawyerUserId }.
export async function startConversation(req, res) {
  if (req.user.role !== "client") {
    throw new ApiError(403, "Only clients can start a conversation");
  }
  const conversation = await startConversationForClient({
    clientUserId: req.user.sub,
    lawyerUserId: req.body.lawyerUserId,
  });
  return res.status(200).json({ conversation });
}

// GET /api/chat/conversations/:conversationId -> { conversation }
export async function getConversation(req, res) {
  const conversation = await getConversationHeader({
    conversationId: req.params.conversationId,
    userId: req.user.sub,
  });
  return res.status(200).json({ conversation });
}

// GET /api/chat/conversations/:conversationId/messages -> { messages }
export async function getConversationMessages(req, res) {
  const { messages } = await listMessages({
    conversationId: req.params.conversationId,
    userId: req.user.sub,
  });
  return res.status(200).json({ messages });
}

// POST /api/chat/conversations/:conversationId/messages -> { message }
export async function sendMessage(req, res) {
  const { message, participant } = await createTextMessage({
    conversationId: req.params.conversationId,
    userId: req.user.sub,
    body: req.body?.text,
    replyToMessageId: req.body?.replyToMessageId,
  });
  await deliverMessage(participant, message);
  return res.status(201).json({ message });
}

// POST /api/chat/conversations/:conversationId/attachments -> { message }
// Multipart: a single "file" field, plus optional "kind" ('file' | 'voice')
// and "durationSeconds" (for voice). The file itself is parsed by the
// uploadChatAttachment middleware into req.file.
export async function sendAttachment(req, res) {
  if (!req.file) {
    throw new ApiError(400, "No file uploaded");
  }
  const { message, participant } = await createAttachmentMessage({
    conversationId: req.params.conversationId,
    userId: req.user.sub,
    file: req.file,
    kind: req.body?.kind === "voice" ? "voice" : "file",
    voiceDurationSeconds: req.body?.durationSeconds,
  });
  await deliverMessage(participant, message);
  return res.status(201).json({ message });
}

// POST /api/chat/conversations/:conversationId/read -> { read: true }
export async function markRead(req, res) {
  const result = await markConversationRead({
    conversationId: req.params.conversationId,
    userId: req.user.sub,
  });
  // Tell the other party (live) that their messages were seen.
  try {
    pushReadReceipt({
      toUserId: result.participant.counterpart.id,
      conversationId: req.params.conversationId,
      readAt: result.readAt,
    });
  } catch (err) {
    console.error("[chat] read receipt failed:", err?.message);
  }
  return res.status(200).json({ read: result.read });
}
