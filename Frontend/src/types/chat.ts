export type ChatParticipantStatus = "online" | "offline";

export interface ChatClient {
  id: string;
  name: string;
  initials: string;
  status: ChatParticipantStatus;
}

export interface ChatLawyer {
  id: string;
  name: string;
  initials: string;
  status: ChatParticipantStatus;
}

export interface LawyerChatThread {
  id: string;
  client: ChatClient;
  caseId?: string;
  tags: string[];
  lastMessage: string;
  lastMessageAt: string; // ISO
  unreadCount: number;
}

export interface ClientChatThread {
  id: string;
  lawyer: ChatClient;  // <-- note: lawyer instead of client
  caseId?: string;
  tags: string[];
  lastMessage: string;
  lastMessageAt: string; // ISO
  unreadCount: number;
}

export type ChatSender = "lawyer" | "client";

// A plain text message, a shared document ("file"), or a recorded voice note.
export type ChatMessageKind = "text" | "file" | "voice";

export interface ChatMessage {
  id: string;
  threadId: string;
  sender: ChatSender;
  text: string;
  createdAt: string; // ISO

  // Attachment fields (Chunk 2). Present for "file" / "voice" messages; null
  // or omitted for plain text. attachmentUrl is a short-lived signed URL the
  // browser can open/play directly.
  kind?: ChatMessageKind;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  attachmentSize?: number | null;
  attachmentUrl?: string | null;
  voiceDurationSeconds?: number | null;

  // "Seen" tick (Chunk 4): true once the other participant has read this
  // message (their last-read time has passed it).
  seen?: boolean;

  // Quoted reply (Chunk 5): the message this one is replying to, with a short
  // preview to render in the quoted bar. null/omitted for a normal message.
  replyTo?: { id: string; sender: ChatSender; preview: string } | null;

  // True once the text has been edited (Chunk 6) — the UI shows an "edited" tag.
  edited?: boolean;
}

export interface SendMessagePayload {
  text: string;
  // When set, this message quotes another (reply).
  replyToMessageId?: string;
}
