import { formatDate } from "../../../shared/utils/formatDate";

// Chat message roles
export type AiChatRole = "ai" | "user";

// Single message shape used in UI + API
export type AiChatMessage = {
  id: string;
  role: AiChatRole;
  text: string;
  time: string; // display-only (formatted)
  kind?: "intro" | "list" | "message" | "error";
};

// A saved conversation as listed in the sidebar.
export type AiChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

// One stored message as returned by the backend (server timestamps, not the
// UI's display string).
export type AiStoredMessage = {
  id: string;
  role: AiChatRole;
  text: string;
  createdAt: string;
};

// A full conversation with its messages (sidebar metadata + transcript).
export type AiChatSessionDetail = AiChatSession & {
  messages: AiStoredMessage[];
};

// The assistant's opening greeting. The real conversation starts empty — the
// lawyer's first message is the first user turn.
export function getInitialAiGuidanceMessages(): AiChatMessage[] {
  return [
    {
      id: "m-1",
      role: "ai",
      text: "Hello! I'm your AI Legal Assistant. How can I help you today?",
      time: formatDate(new Date(), "time"),
      kind: "intro",
    },
  ];
}
