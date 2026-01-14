import { useEffect, useState, useRef } from "react";
import { useParams } from "@tanstack/react-router";
import ChatDetailLayout from "../../../shared/components/ChatDetailLayout";
import ChatMessageBubble from "../components/ChatMessageBubble";
import ChatComposer from "../components/ChatComposer";
import { getThreadMessages, sendThreadMessage, getThreadById } from "../api";
import { initiateVoiceCall } from "../utils/voiceCall";
import type { ChatMessage, LawyerChatThread } from "../../../types/chat";

export default function ChatDetail() {
  const { threadId } = useParams({ from: "/lawyer-chat/$threadId" });
  const [thread, setThread] = useState<LawyerChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load thread and messages on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const threadData = await getThreadById(threadId);
        const messagesData = await getThreadMessages(threadId);
        
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

  const handleSendMessage = async (text: string) => {
    const newMsg = await sendThreadMessage(threadId, { text });
    setMessages((prev) => [...prev, newMsg]);
  };

  const handleVoiceCall = () => {
    if (thread?.client) {
      initiateVoiceCall({
        clientId: thread.client.id,
        clientName: thread.client.name,
      });
    }
  };

  if (loading) {
    return (
      <ChatDetailLayout
        clientName="Loading..."
        onVoiceCall={handleVoiceCall}
      >
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
      clientName={thread.client.name}
      clientStatus={thread.client.status}
      onVoiceCall={handleVoiceCall}
    >
      <div className="flex flex-col h-full bg-white">
        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto py-6 space-y-5 px-4 sm:px-8">
          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Composer - Sticky at bottom */}
        <div className="sticky bottom-0 z-40 border-t border-gray-200 bg-white px-4 sm:px-8 py-4 shadow-lg">
          <ChatComposer onSend={handleSendMessage} />
        </div>
      </div>
    </ChatDetailLayout>
  );
}
