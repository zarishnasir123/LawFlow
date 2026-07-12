export type ChatParticipantStatus = "online" | "offline";

export interface ChatClient {
  id: string;
  name: string;
  initials: string;
  status: ChatParticipantStatus;
  // Public URL of the person's uploaded profile photo; null when they have
  // none (the UI falls back to their initials).
  avatarUrl?: string | null;
}

export interface ChatLawyer {
  id: string;
  name: string;
  initials: string;
  status: ChatParticipantStatus;
  avatarUrl?: string | null;
}

// The real profile of the OTHER participant in a conversation, for the
// interaction side-panel. The backend returns the counterpart of the caller:
// a lawyer receives the client's contact fields (cnic/city/tehsil); a client
// receives the lawyer's professional fields (specialization/districtBar/...).
// The fields not relevant to a given counterpart are omitted/null.
export interface ChatParticipantProfile {
  id: string;
  role: ChatSender;
  name: string;
  initials: string;
  email: string | null;
  // Client counterpart (shown to the lawyer)
  cnic?: string | null;
  city?: string | null;
  tehsil?: string | null;
  address?: string | null;
  // Lawyer counterpart (shown to the client)
  specialization?: string | null;
  districtBar?: string | null;
  barLicenseNumber?: string | null;
  experienceYears?: number | null;
}

export interface LawyerChatThread {
  id: string;
  client: ChatClient;
  caseId?: string;
  tags: string[];
  lastMessage: string;
  // Kind of the last message, so the inbox can show a Mic/Paperclip icon.
  lastMessageKind?: ChatMessageKind | null;
  lastMessageAt: string; // ISO
  unreadCount: number;
}

export interface ClientChatThread {
  id: string;
  lawyer: ChatClient;  // <-- note: lawyer instead of client
  caseId?: string;
  tags: string[];
  lastMessage: string;
  // Kind of the last message, so the inbox can show a Mic/Paperclip icon.
  lastMessageKind?: ChatMessageKind | null;
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
