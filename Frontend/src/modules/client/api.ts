import { apiClient } from "../../shared/api/axios";
import type {
  AuthResponse,
  ClientCnicVerificationPayload,
  ClientEmailVerificationPayload,
  ClientEmailVerificationRequest,
  ClientLoginPayload,
  ClientRegisterPayload,
  RegisterResponse,
  VerificationResponse,
} from "../auth/types";

export async function registerClient(
  payload: ClientRegisterPayload
): Promise<RegisterResponse> {
  const { data } = await apiClient.post<RegisterResponse>("/auth/register/client", payload);
  return data;
}

export async function loginClient(payload: ClientLoginPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", {
    ...payload,
    expectedRole: "client",
  });
  return data;
}

export async function sendClientEmailVerification(
  payload: ClientEmailVerificationRequest
): Promise<VerificationResponse> {
  const { data } = await apiClient.post<VerificationResponse>(
    "/auth/resend-verification-otp",
    payload
  );
  return data;
}

export async function verifyClientEmail(
  payload: ClientEmailVerificationPayload
): Promise<VerificationResponse> {
  const { data } = await apiClient.post<VerificationResponse>(
    "/auth/verify-email",
    payload
  );
  return data;
}

export async function verifyClientCnic(
  payload: ClientCnicVerificationPayload
): Promise<VerificationResponse> {
  const { data } = await apiClient.post<VerificationResponse>(
    "/auth/client/cnic/verify",
    payload
  );
  return data;
}
import type {
  ChatClient,
  ChatMessage,
  SendMessagePayload,
  ClientChatThread,
} from "../../types/chat";

// =====================================================================
// Case chat (real backend). The conversation id IS the case id, so the
// `threadId` the chat screens pass around is a case UUID. The backend
// returns a role-agnostic `counterpart`; for the client app that's the
// lawyer, so we map it onto the ClientChatThread.lawyer field the UI uses.
// =====================================================================

interface ChatConversationDto {
  id: string;
  counterpart: ChatClient;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
}

function toClientThread(dto: ChatConversationDto): ClientChatThread {
  return {
    id: dto.id,
    lawyer: dto.counterpart,
    tags: [],
    lastMessage: dto.lastMessage ?? "",
    lastMessageAt: dto.lastMessageAt ?? new Date().toISOString(),
    unreadCount: dto.unreadCount ?? 0,
  };
}

/**
 * Start (or reopen) a direct conversation with a lawyer from the directory.
 * Idempotent — clicking "Message" again returns the same conversation.
 * Returns the conversation's id so the caller can open the chat screen.
 */
export async function startConversationWithLawyer(
  lawyerUserId: string
): Promise<ClientChatThread> {
  const { data } = await apiClient.post<{ conversation: ChatConversationDto }>(
    "/chat/conversations",
    { lawyerUserId }
  );
  return toClientThread(data.conversation);
}

/**
 * Get all chat conversations for the signed-in client (one per linked case).
 */
export async function getClientThreads(): Promise<ClientChatThread[]> {
  const { data } = await apiClient.get<{ conversations: ChatConversationDto[] }>(
    "/chat/conversations"
  );
  return (data.conversations ?? []).map(toClientThread);
}

/**
 * Get a single conversation's header info by case id.
 */
export async function getClientThreadById(
  threadId: string
): Promise<ClientChatThread | null> {
  try {
    const { data } = await apiClient.get<{ conversation: ChatConversationDto }>(
      `/chat/conversations/${threadId}`
    );
    return toClientThread(data.conversation);
  } catch {
    return null;
  }
}

/**
 * Get all messages for a specific conversation.
 */
export async function getClientThreadMessages(
  threadId: string
): Promise<ChatMessage[]> {
  const { data } = await apiClient.get<{ messages: ChatMessage[] }>(
    `/chat/conversations/${threadId}/messages`
  );
  return data.messages ?? [];
}

/**
 * Send a text message as the client user.
 */
export async function sendClientThreadMessage(
  threadId: string,
  payload: SendMessagePayload
): Promise<ChatMessage> {
  const { data } = await apiClient.post<{ message: ChatMessage }>(
    `/chat/conversations/${threadId}/messages`,
    { text: payload.text, replyToMessageId: payload.replyToMessageId }
  );
  return data.message;
}

/**
 * Mark the whole conversation read up to now (unread badges + "seen" tick).
 */
export async function markClientThreadRead(threadId: string): Promise<void> {
  await apiClient.post(`/chat/conversations/${threadId}/read`);
}

/**
 * Upload a document to the conversation. Returns the created (file) message
 * with a ready-to-open signed URL.
 */
export async function sendClientThreadFile(
  threadId: string,
  file: File
): Promise<ChatMessage> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", "file");
  const { data } = await apiClient.post<{ message: ChatMessage }>(
    `/chat/conversations/${threadId}/attachments`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data.message;
}

/**
 * Upload a recorded voice note. Returns the created (voice) message.
 */
export async function sendClientThreadVoice(
  threadId: string,
  blob: Blob,
  durationSeconds: number,
  mimeType: string
): Promise<ChatMessage> {
  const file = voiceBlobToFile(blob, mimeType);
  const form = new FormData();
  form.append("file", file);
  form.append("kind", "voice");
  form.append("durationSeconds", String(durationSeconds));
  const { data } = await apiClient.post<{ message: ChatMessage }>(
    `/chat/conversations/${threadId}/attachments`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data.message;
}

// Turn a recorded audio blob into a named File the backend can store. The
// extension mirrors the recorder's container so the saved object plays back.
function voiceBlobToFile(blob: Blob, mimeType: string): File {
  const base = (mimeType || "audio/webm").split(";")[0];
  const ext = base.includes("mp4")
    ? "m4a"
    : base.includes("ogg")
      ? "ogg"
      : base.includes("mpeg")
        ? "mp3"
        : base.includes("wav")
          ? "wav"
          : "webm";
  return new File([blob], `voice-message.${ext}`, { type: base });
}

