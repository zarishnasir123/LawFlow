import { Fragment, useEffect, useState, useRef } from "react";
import { useParams } from "@tanstack/react-router";
import ChatDetailLayout from "../../../shared/components/ChatDetailLayout";
import ChatMessageBubble from "../components/ChatMessageBubble";
import ChatComposer from "../components/ChatComposer";
import ChatDateSeparator from "../../../shared/components/ChatDateSeparator";

import {
  getClientThreadById,
  getClientThreadMessages,
  sendClientThreadMessage,
  sendClientThreadFile,
  sendClientThreadVoice,
  markClientThreadRead,
} from "../api"; // Client-side API
import { getApiErrorMessage } from "../../../shared/utils/getApiErrorMessage";
import { chatSocket } from "../../../shared/api/chatSocket";
import { useChatSocket } from "../../../shared/hooks/useChatSocket";
import {
  upsertMessage,
  replaceMessage,
  messagePreview,
  isSameDay,
} from "../../../shared/utils/chatMessages";
import type { ChatMessage, ClientChatThread } from "../../../types/chat";

export default function ClientChatDetail() {
  const { threadId } = useParams({ strict: false });
  const [thread, setThread] = useState<ClientChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const typingClearRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);

  // Live channel: subscribe to this conversation and react to live events.
  useEffect(() => {
    if (!threadId) return;
    chatSocket.subscribe(threadId);
    return () => chatSocket.unsubscribe(threadId);
  }, [threadId]);

  useChatSocket({
    onMessage: (conversationId, message) => {
      if (conversationId !== threadId) return;
      setMessages((prev) => upsertMessage(prev, message));
      if (message.sender !== "client") {
        markClientThreadRead(threadId).catch(() => {});
      }
    },
    onMessageUpdate: (conversationId, message) => {
      if (conversationId !== threadId) return;
      setMessages((prev) => replaceMessage(prev, message));
    },
    onRead: (conversationId, readAt) => {
      if (conversationId !== threadId) return;
      const readMs = new Date(readAt).getTime();
      setMessages((prev) =>
        prev.map((m) =>
          m.sender === "client" &&
          !m.seen &&
          new Date(m.createdAt).getTime() <= readMs
            ? { ...m, seen: true }
            : m
        )
      );
    },
    onTyping: (conversationId, _from, isTyping) => {
      if (conversationId !== threadId) return;
      if (typingClearRef.current) window.clearTimeout(typingClearRef.current);
      if (isTyping) {
        setTyping(true);
        typingClearRef.current = window.setTimeout(() => setTyping(false), 3000);
      } else {
        setTyping(false);
      }
    },
    onPresence: (userId, online) => {
      setThread((prev) =>
        prev && prev.lawyer.id === userId
          ? { ...prev, lawyer: { ...prev.lawyer, status: online ? "online" : "offline" } }
          : prev
      );
    },
  });

  // Scroll to bottom on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load thread and messages
  useEffect(() => {
    if (!threadId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const threadData = await getClientThreadById(threadId);
        const messagesData = await getClientThreadMessages(threadId);

        setThread(threadData);
        setMessages(messagesData);
        markClientThreadRead(threadId).catch(() => {});
      } catch (error) {
        console.error("Error loading chat:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [threadId]);

  // Send a new message
  const handleSendMessage = async (text: string) => {
    if (!threadId) return;
    const newMsg = await sendClientThreadMessage(threadId, {
      text,
      replyToMessageId: replyTarget?.id,
    });
    setMessages((prev) => upsertMessage(prev, newMsg));
    setReplyTarget(null);
  };

  const handleSendFiles = async (files: File[]) => {
    if (!threadId) return;
    for (const file of files) {
      try {
        const msg = await sendClientThreadFile(threadId, file);
        setMessages((prev) => upsertMessage(prev, msg));
      } catch (error) {
        console.error("Error uploading file:", error);
        alert(getApiErrorMessage(error, "Could not upload that file."));
      }
    }
  };

  const handleSendVoice = async (
    blob: Blob,
    durationSeconds: number,
    mimeType: string
  ) => {
    if (!threadId) return;
    try {
      const msg = await sendClientThreadVoice(
        threadId,
        blob,
        durationSeconds,
        mimeType
      );
      setMessages((prev) => upsertMessage(prev, msg));
    } catch (error) {
      console.error("Error sending voice message:", error);
      alert(getApiErrorMessage(error, "Could not send the voice message."));
    }
  };

  if (loading) {
    return (
      <ChatDetailLayout clientName="Loading...">
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Loading chat...</p>
        </div>
      </ChatDetailLayout>
    );
  }

  if (!thread) {
    return (
      <ChatDetailLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Chat not found</p>
        </div>
      </ChatDetailLayout>
    );
  }

  return (
    <ChatDetailLayout
      clientName={thread.lawyer.name} // show lawyer
      clientStatus={thread.lawyer.status}
      statusText={typing ? "typing…" : undefined}
    >
      <div className="flex flex-col h-full bg-white">
        {/* Messages container */}
        <div className="flex-1 overflow-y-auto py-6 space-y-5 px-4 sm:px-8">
          {messages.map((msg, i) => {
            const prev = messages[i - 1];
            const showDate =
              !prev || !isSameDay(prev.createdAt, msg.createdAt);
            return (
              <Fragment key={msg.id}>
                {showDate && <ChatDateSeparator iso={msg.createdAt} />}
                <ChatMessageBubble msg={msg} onReply={setReplyTarget} />
              </Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="sticky bottom-0 z-40 border-t border-gray-200 bg-white px-4 sm:px-8 py-4 shadow-lg">
          <ChatComposer
            onSend={handleSendMessage}
            onSendFiles={handleSendFiles}
            onSendVoice={handleSendVoice}
            onTyping={(isTyping) =>
              threadId && chatSocket.sendTyping(threadId, isTyping)
            }
            replyPreview={replyTarget ? messagePreview(replyTarget) : null}
            onCancelReply={() => setReplyTarget(null)}
          />
        </div>
      </div>
    </ChatDetailLayout>
  );
}
