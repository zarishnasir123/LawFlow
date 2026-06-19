import { useEffect, useRef } from "react";
import { chatSocket, type ChatSocketEvent } from "../api/chatSocket";
import type { ChatMessage } from "../../types/chat";

export interface ChatSocketHandlers {
  onMessage?: (conversationId: string, message: ChatMessage) => void;
  onTyping?: (conversationId: string, from: string, isTyping: boolean) => void;
  onPresence?: (userId: string, online: boolean) => void;
}

// Subscribe a component to the shared chat socket. Handlers are kept in a ref
// so the listener is attached once and never needs re-binding when the
// component re-renders with fresh closures.
export function useChatSocket(handlers: ChatSocketHandlers) {
  const ref = useRef(handlers);

  // Keep the ref pointed at the latest handlers (updated in an effect, not
  // during render) so the single listener below always calls fresh closures.
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const off = chatSocket.on((event: ChatSocketEvent) => {
      if (event.type === "message") {
        ref.current.onMessage?.(event.conversationId, event.message);
      } else if (event.type === "typing") {
        ref.current.onTyping?.(event.conversationId, event.from, event.isTyping);
      } else if (event.type === "presence") {
        ref.current.onPresence?.(event.userId, event.online);
      }
    });
    return off;
  }, []);
}
