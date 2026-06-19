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
