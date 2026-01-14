export type ChatParticipantStatus = "online" | "offline";

export interface ChatClient {
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

export type ChatSender = "lawyer" | "client";

export interface ChatMessage {
  id: string;
  threadId: string;
  sender: ChatSender;
  text: string;
  createdAt: string; // ISO
}

export interface SendMessagePayload {
  text: string;
}
