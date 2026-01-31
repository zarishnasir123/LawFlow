import { useMemo, useState, useEffect, useRef } from "react";
import {
  Search,
  MessageCircle,
  ArrowLeft,
  Download,
} from "lucide-react";
import LawyerLayout from "../components/LawyerLayout";
import ChatMessageBubble from "../components/ChatMessageBubble";
import ChatComposer from "../components/ChatComposer";
import ClientInfoSidebar from "../components/ClientInfoSidebar";
import type { LawyerChatThread, ChatMessage } from "../../../types/chat";
import { getLawyerThreads, getThreadMessages, sendThreadMessage } from "../api";

export default function Messages() {
  const [threads, setThreads] = useState<LawyerChatThread[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [showClientInfo, setShowClientInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ name: string; size: number; uploadedAt: string }>
  >([]);

  // Format last seen time
  const formatLastSeen = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Load threads on mount
  useEffect(() => {
    const loadThreads = async () => {
      setLoading(true);
      try {
        const data = await getLawyerThreads();
        setThreads(data);
      } catch (error) {
        console.error("Error loading threads:", error);
      } finally {
        setLoading(false);
      }
    };

    loadThreads();
  }, []);

  // Load messages when thread is selected
  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setMessagesLoading(true);
      try {
        const data = await getThreadMessages(selectedThreadId);
        setMessages(data);
      } catch (error) {
        console.error("Error loading messages:", error);
      } finally {
        setMessagesLoading(false);
      }
    };

    loadMessages();
  }, [selectedThreadId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      return t.client.name.toLowerCase().includes(q);
    });
  }, [threads, search]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  const handleSendMessage = async (text: string) => {
    if (!selectedThreadId) return;
    try {
      const newMsg = await sendThreadMessage(selectedThreadId, { text });
      setMessages((prev) => [...prev, newMsg]);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleFileUpload = (files: File[]) => {
    // In real app, would upload to server
    const newFiles = files.map((file) => ({
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  return (
    <LawyerLayout
      brandTitle="LawFlow"
      brandSubtitle="Direct Messages"
    >
      <div className="flex gap-4 h-[calc(100vh-130px)] lg:gap-5 p-2">
        {/* Left Sidebar - Conversations - Hidden on mobile when chat is selected */}
        <div
          className={`${
            selectedThreadId ? "hidden sm:flex" : "flex"
          } w-full sm:w-72 lg:w-80 bg-white rounded-xl overflow-hidden flex-col flex-shrink-0 border-2 border-gray-300 shadow-sm`}
        >
          <div className="px-5 py-4 border-b-2 border-gray-300 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="text-base font-bold text-gray-900 mb-4">
              Conversations
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01411C]/30 focus:border-[#01411C] text-sm bg-white"
              />
            </div>
          </div>

          {/* Thread List - Only this scrolls */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                Loading conversations...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {threads.length === 0
                  ? "No conversations yet"
                  : "No matching conversations"}
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full px-5 py-3.5 text-left border-b-2 border-gray-300 hover:bg-green-50/50 transition ${
                    selectedThreadId === thread.id
                      ? "bg-green-50/80 border-l-4 border-l-[#01411C]"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-[#01411C] text-white text-xs font-bold flex items-center justify-center">
                        {thread.client.initials}
                      </div>
                      <div
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                          thread.client.status === "online"
                            ? "bg-green-500"
                            : "bg-gray-400"
                        }`}
                      ></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 text-sm truncate">
                          {thread.client.name}
                        </h3>
                        {thread.unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-1">
                        {thread.lastMessage}
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          thread.client.status === "online"
                            ? "text-green-600 font-medium"
                            : "text-gray-500"
                        }`}
                      >
                        {thread.client.status === "online"
                          ? "Online"
                          : `Last seen ${formatLastSeen(thread.lastMessageAt)}`}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Side - Chat Area with Client Info */}
        <div
          className={`${
            selectedThreadId ? "flex sm:flex" : "hidden sm:flex"
          } flex-1 bg-white rounded-xl overflow-hidden flex-row border-2 border-gray-300 shadow-sm relative`}
        >
          {/* Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedThread ? (
            // Empty State
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-lg font-semibold mb-2">
                  Select a conversation
                </p>
                <p className="text-sm">
                  Choose a client from the list to start messaging
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-white border-b-2 border-gray-300 px-5 py-4">
                <div className="flex items-center gap-4">
                  {selectedThreadId && (
                    <button
                      onClick={() => setSelectedThreadId(null)}
                      className="sm:hidden text-gray-600 hover:text-[#01411C] transition hover:bg-gray-100 p-1.5 rounded-lg"
                      title="Back to conversations"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  )}
                    <div className="relative cursor-pointer hover:opacity-80 transition" onClick={() => setShowClientInfo(!showClientInfo)}>
                    <div className="w-11 h-11 rounded-full bg-[#01411C] text-white text-sm font-bold flex items-center justify-center shadow-sm">
                      {selectedThread.client.initials}
                    </div>
                    <div
                      className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                        selectedThread.client.status === "online"
                          ? "bg-green-500"
                          : "bg-gray-400"
                      }`}
                    ></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-gray-900">
                      {selectedThread.client.name}
                    </h2>
                    <p
                      className={`text-xs font-medium ${
                        selectedThread.client.status === "online"
                          ? "text-green-600"
                          : "text-gray-500"
                      }`}
                    >
                      {selectedThread.client.status === "online"
                        ? "● Online"
                        : `Last seen ${formatLastSeen(selectedThread.lastMessageAt)}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Chat Content Area */}
              <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
                {/* Messages - Only this scrolls */}
                <div className="flex-1 overflow-y-auto py-3 space-y-3 px-5 sm:px-8">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500 text-sm">Loading messages...</p>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500 text-center text-sm">
                          No messages yet. Start the conversation!
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <ChatMessageBubble key={msg.id} msg={msg} />
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Shared Documents Section */}
                  {uploadedFiles.length > 0 && (
                    <div className="flex-shrink-0 bg-white border-t-2 border-gray-300 px-5 sm:px-8 py-2">
                      <div className="mb-1">
                        <h3 className="text-sm font-bold text-gray-900 mb-3">
                          📎 Shared Documents
                        </h3>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {uploadedFiles.map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-white p-3 rounded-lg border-2 border-gray-300 hover:bg-gray-100/50 transition"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {file.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {(file.size / 1024).toFixed(2)} KB • {file.uploadedAt}
                                </p>
                              </div>
                              <button
                                className="ml-2 text-[#01411C] hover:bg-green-100 p-2 rounded-lg transition flex-shrink-0"
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Message Composer - No scroll */}
                  <div className="flex-shrink-0 border-t-2 border-gray-300">
                    <ChatComposer
                      onSend={handleSendMessage}
                      onFileUpload={handleFileUpload}
                    />
                  </div>
                </div>
            </>
          )}
          </div>

          {/* Client Info Sidebar - Smooth slide-in animation on right */}
          {selectedThread && (
            <ClientInfoSidebar
              thread={selectedThread}
              isOpen={showClientInfo}
              onClose={() => setShowClientInfo(false)}
              sharedDocuments={uploadedFiles}
            />
          )}
        </div>
      </div>
    </LawyerLayout>
  );
}
