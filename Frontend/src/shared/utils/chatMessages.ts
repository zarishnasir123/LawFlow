import type { ChatMessage } from "../../types/chat";

// Append a message only if it isn't already in the list (by id). Used by every
// chat append site so a message that arrives via BOTH the REST reply and the
// live WebSocket echo is never shown twice, regardless of which lands first.
export function upsertMessage(
  list: ChatMessage[],
  msg: ChatMessage
): ChatMessage[] {
  return list.some((m) => m.id === msg.id) ? list : [...list, msg];
}

// Replace a message in the list by id (used for live edits). No-op if absent.
export function replaceMessage(
  list: ChatMessage[],
  msg: ChatMessage
): ChatMessage[] {
  return list.map((m) => (m.id === msg.id ? { ...m, ...msg } : m));
}

// One-line preview of a message (reply bar, inbox last-message).
export function messagePreview(msg: ChatMessage): string {
  if (msg.kind === "file") return "📎 Document";
  if (msg.kind === "voice") return "🎤 Voice message";
  return msg.text;
}

// True if two ISO timestamps fall on the same calendar day (local time).
export function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// "Today" / "Yesterday" / "12 Jun 2026" for a chat date separator.
export function dateSeparatorLabel(iso: string): string {
  const now = new Date();
  const todayIso = now.toISOString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(iso, todayIso)) return "Today";
  if (isSameDay(iso, yesterday.toISOString())) return "Yesterday";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
