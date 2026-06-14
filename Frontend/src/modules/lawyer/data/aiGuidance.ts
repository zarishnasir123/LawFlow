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

// Starter prompts shown before the lawyer's first message. These map to
// LawFlow's real case templates and capabilities, so clicking one produces a
// grounded answer rather than an out-of-scope reply.
export const aiGuidanceQuickSuggestions = [
  "Which template fits a Khula (judicial divorce) case?",
  "Documents needed for a recovery of money suit",
  "Draft the jurisdiction paragraph for a dowry recovery suit",
  "What schedules does a family suit require?",
];

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
