import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import {
  Search,
  FileText,
  MessageSquare,
  Users,
  Settings,
  MoreVertical,
  MessageCircle,
} from "lucide-react";
import ChatMessageBubble from "../components/ChatMessageBubble";
import ChatComposer from "../components/ChatComposer";
import { getThreadMessages, sendThreadMessage, getThreadById } from "../api";
import type { ChatMessage, LawyerChatThread } from "../../../types/chat";

export default function ChatDetail() {
  const { threadId } = useParams({ from: "/lawyer-chat/$threadId" });
  const navigate = useNavigate();
  const [thread, setThread] = useState<LawyerChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"messages" | "participants">(
    "messages"
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-gray-500">Loading chat...</p>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-gray-500">Chat not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => navigate({ to: "/lawyer-messages" })}
              className="p-2 hover:bg-gray-100 rounded-lg transition lg:hidden"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {thread.client.name}
              </h2>
              <p className="text-sm text-gray-500">
                {thread.client.status === "online" ? "🟢 Online" : "⚫ Offline"}
              </p>
            </div>
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition">
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-6 border-t border-gray-200">
          <button
            onClick={() => setActiveTab("messages")}
            className={`py-3 font-medium text-sm transition ${
              activeTab === "messages"
                ? "text-green-600 border-b-2 border-green-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Messages
          </button>
          <button
            onClick={() => setActiveTab("participants")}
            className={`py-3 font-medium text-sm transition ${
              activeTab === "participants"
                ? "text-green-600 border-b-2 border-green-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Participants
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto py-6 space-y-5 px-4 sm:px-8">
            {messages.map((msg) => (
              <ChatMessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Composer - Sticky at bottom */}
          <div className="sticky bottom-0 z-30 border-t border-gray-200 bg-white px-4 sm:px-8 py-4 shadow-lg">
            <ChatComposer onSend={handleSendMessage} />
          </div>
        </div>

        {/* Right Sidebar - Files & Details */}
        <div className="hidden lg:flex lg:w-80 lg:flex-col lg:border-l lg:border-gray-200 bg-gray-50">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Shared Files
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search files..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* File Types */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Sample File Categories */}
            <div className="bg-white rounded-lg p-4 hover:shadow-md transition cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Documents</p>
                  <p className="text-sm text-gray-500">126 files</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 hover:shadow-md transition cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Images</p>
                  <p className="text-sm text-gray-500">45 files</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 hover:shadow-md transition cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Other</p>
                  <p className="text-sm text-gray-500">18 files</p>
                </div>
              </div>
            </div>
          </div>

          {/* File Details Footer */}
          <div className="p-6 border-t border-gray-200 bg-white">
            <p className="text-xs text-gray-500">Total files: 189</p>
            <p className="text-xs text-gray-500">Storage: 1.2 GB</p>
          </div>
        </div>
      </div>
    </div>
  );
}
