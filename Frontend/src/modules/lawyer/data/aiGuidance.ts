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
