import { useEffect, useState, useRef } from "react";
import { useParams } from "@tanstack/react-router";
import ChatDetailLayout from "../../../shared/components/ChatDetailLayout";
import ChatMessageBubble from "../components/ChatMessageBubble";
import ChatComposer from "../components/ChatComposer";
import { initiateVoiceCall } from "../utils/voicecall";

import {
  getClientThreadById,
  getClientThreadMessages,
  sendClientThreadMessage,
} from "../api"; // Client-side API
import type { ChatMessage, ClientChatThread } from "../../../types/chat";

export default function ClientChatDetail() {
  const { threadId } = useParams({ strict: false });
  const [thread, setThread] = useState<ClientChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    const newMsg = await sendClientThreadMessage(threadId, { text });
    setMessages((prev) => [...prev, newMsg]);
  };

  // Voice call
  const handleVoiceCall = () => {
    if (thread?.lawyer) {
      initiateVoiceCall({
        clientId: thread.lawyer.id,
        clientName: thread.lawyer.name,
      });
    }
  };

  if (loading) {
    return (
      <ChatDetailLayout clientName="Loading..." onVoiceCall={handleVoiceCall}>
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
      onVoiceCall={handleVoiceCall} // ✅ voice call button
    >
      <div className="flex flex-col h-full bg-white">
        {/* Messages container */}
        <div className="flex-1 overflow-y-auto py-6 space-y-5 px-4 sm:px-8">
          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="sticky bottom-0 z-40 border-t border-gray-200 bg-white px-4 sm:px-8 py-4 shadow-lg">
          <ChatComposer onSend={handleSendMessage} />
        </div>
      </div>
    </ChatDetailLayout>
  );
}
