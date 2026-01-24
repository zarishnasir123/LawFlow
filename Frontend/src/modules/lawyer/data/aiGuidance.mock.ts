import { formatDate } from "../../../shared/utils/formatDate";

// Chat message roles
export type AiChatRole = "ai" | "user";

// Single message shape used in UI + API
export type AiChatMessage = {
  id: string;
  role: AiChatRole;
  text: string;
  time: string; // display-only (formatted)
  kind?: "intro" | "list" | "message";
};

// Quick prompts for first-time screen
export const aiGuidanceQuickSuggestions = [
  "Draft a civil suit petition",
  "Required documents for property dispute",
  "Family law case filing procedure",
  "Appeal application guidance",
];

// Initial system messages (shown when page opens)
export function getInitialAiGuidanceMessages(): AiChatMessage[] {
  const now = formatDate(new Date(), "time");

  return [
    {
      id: "m-1",
      role: "ai",
      text: "Hello! I'm your AI Legal Assistant. How can I help you today?",
      time: now,
      kind: "intro",
    },
    {
      id: "m-2",
      role: "user",
      text: "What services can you provide?",
      time: now,
      kind: "message",
    },
  ];
}

// Mock AI response generator (temporary until backend is ready)
export function generateAiMockResponse(prompt: string): AiChatMessage {
  const lower = prompt.toLowerCase();
  let text = "";

  // Simple keyword-based responses (mock behavior)
  if (lower.includes("property") || lower.includes("civil")) {
    text =
      "For a property dispute case, you'll need:\n\n" +
      "1. Property ownership documents\n" +
      "2. Sale deed or transfer documents\n" +
      "3. Land registry certificates\n" +
      "4. CNIC copies of all parties\n" +
      "5. Any previous agreements or notices\n\n" +
      "Would you like me to draft the petition?";
  } else if (lower.includes("family")) {
    text =
      "For family law matters, you usually need:\n\n" +
      "1. Nikah Nama\n" +
      "2. CNIC of both spouses\n" +
      "3. Children details (if any)\n" +
      "4. Address proof\n\n" +
      "Tell me your exact case type.";
  } else if (lower.includes("draft") || lower.includes("petition")) {
    text =
      "To draft a legal petition, provide:\n\n" +
      "1. Case type\n" +
      "2. Parties names\n" +
      "3. Case facts\n" +
      "4. Relief you want\n\n" +
      "I will prepare a structured draft for you.";
  } else {
    text =
      "Please specify:\n\n" +
      "• Case type\n" +
      "• Legal issue\n" +
      "• What you need (draft, documents, procedure)\n\n" +
      "So I can help accurately.";
  }

  return {
    id: `ai-${Date.now()}`,
    role: "ai",
    text,
    time: formatDate(new Date(), "time"),
    kind: "message",
  };
}
