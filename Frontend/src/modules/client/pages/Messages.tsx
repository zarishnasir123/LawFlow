import { Fragment, useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Search,
  MessageCircle,
  ArrowLeft,
  Mic,
  Paperclip,
} from "lucide-react";
import ClientLayout from "../components/ClientLayout";
import ChatMessageBubble from "../components/ChatMessageBubble";
import ChatComposer from "../components/ChatComposer";
import ChatDateSeparator from "../../../shared/components/ChatDateSeparator";
import LawyerInfoSidebar from "../components/lawyerInfoSidebar";
import ChatAvatar from "../../../shared/components/ChatAvatar";
import type { ClientChatThread, ChatMessage } from "../../../types/chat";
import {
  getClientThreads,
  getClientThreadMessages,
  sendClientThreadMessage,
  sendClientThreadFile,
  sendClientThreadVoice,
  markClientThreadRead,
} from "../api";
import { getApiErrorMessage } from "../../../shared/utils/getApiErrorMessage";
import { chatSocket } from "../../../shared/api/chatSocket";
import { useChatSocket } from "../../../shared/hooks/useChatSocket";
import {
  upsertMessage,
  replaceMessage,
  messagePreview,
  isSameDay,
} from "../../../shared/utils/chatMessages";

// Inbox preview text for a message (attachments show a label, not blank).
function previewOf(message: ChatMessage): string {
  if (message.kind === "file") return "Document";
  if (message.kind === "voice") return "Voice message";
  return message.text;
}

export default function ClientMessages() {
  const { thread } = useSearch({ strict: false }) as { thread?: string };
  const navigate = useNavigate();
  const [threads, setThreads] = useState<ClientChatThread[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [showLawyerInfo, setShowLawyerInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Which conversation currently shows "…typing" from the other person.
  const [typingThreadId, setTypingThreadId] = useState<string | null>(null);
  const typingClearRef = useRef<number | null>(null);
  // The message currently being replied to (drives the composer reply bar).
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  // In-conversation message search.
  const [msgSearch, setMsgSearch] = useState("");

  // Live channel: subscribe to the open conversation; react to incoming
  // messages, typing, and presence.
  useEffect(() => {
    if (!selectedThreadId) return;
    chatSocket.subscribe(selectedThreadId);
    return () => chatSocket.unsubscribe(selectedThreadId);
  }, [selectedThreadId]);

  useChatSocket({
    onMessage: (conversationId, message) => {
      const isOpen = conversationId === selectedThreadId;
      if (isOpen) {
        setMessages((prev) => upsertMessage(prev, message));
        if (message.sender !== "client") {
          markClientThreadRead(conversationId).catch(() => {});
        }
      }
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== conversationId) return t;
          const fromOther = message.sender !== "client";
          return {
            ...t,
            lastMessage: previewOf(message),
            lastMessageKind: message.kind ?? null,
            lastMessageAt: message.createdAt,
            unreadCount: isOpen
              ? 0
              : fromOther
                ? (t.unreadCount || 0) + 1
                : t.unreadCount,
          };
        })
      );
    },
    onMessageUpdate: (conversationId, message) => {
      if (conversationId === selectedThreadId) {
        setMessages((prev) => replaceMessage(prev, message));
      }
    },
    onRead: (conversationId, readAt) => {
      if (conversationId !== selectedThreadId) return;
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
      if (typingClearRef.current) window.clearTimeout(typingClearRef.current);
      if (isTyping) {
        setTypingThreadId(conversationId);
        typingClearRef.current = window.setTimeout(
          () => setTypingThreadId(null),
          3000
        );
      } else {
        setTypingThreadId(null);
      }
    },
    onPresence: (userId, online) => {
      setThreads((prev) =>
        prev.map((t) =>
          t.lawyer.id === userId
            ? { ...t, lawyer: { ...t.lawyer, status: online ? "online" : "offline" } }
            : t
        )
      );
    },
  });

  // ✅ Format last seen
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

  // ✅ Load all client threads
  useEffect(() => {
    const loadThreads = async () => {
      setLoading(true);
      try {
        const data = await getClientThreads();
        setThreads(data);
      } catch (error) {
        console.error("Error loading threads:", error);
      } finally {
        setLoading(false);
      }
    };
    loadThreads();
  }, []);

  useEffect(() => {
    if (!thread || selectedThreadId) return;
    const match = threads.find((item) => item.id === thread);
    if (match) {
      setSelectedThreadId(match.id);
    }
  }, [thread, threads, selectedThreadId]);

  const handleThreadSelect = (threadId: string) => {
    setSelectedThreadId(threadId);
    navigate({
      to: "/client-messages",
      search: { thread: threadId },
      replace: true,
    });
  };

  const handleThreadClear = () => {
    setSelectedThreadId(null);
    navigate({ to: "/client-messages", search: {}, replace: true });
  };

  // ✅ Load messages when a thread is selected
  useEffect(() => {
    setReplyTarget(null);
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setMessagesLoading(true);
      try {
        const data = await getClientThreadMessages(selectedThreadId);
        setMessages(data);
        markClientThreadRead(selectedThreadId).catch(() => {});
        setThreads((prev) =>
          prev.map((t) =>
            t.id === selectedThreadId ? { ...t, unreadCount: 0 } : t
          )
        );
      } catch (error) {
        console.error("Error loading messages:", error);
      } finally {
        setMessagesLoading(false);
      }
    };

    loadMessages();
  }, [selectedThreadId]);

  // ✅ Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ✅ Filter threads
  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) =>
      t.lawyer.name.toLowerCase().includes(q)
    );
  }, [threads, search]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  // Messages shown in the open chat, narrowed by the in-chat search box.
  const displayedMessages = msgSearch.trim()
    ? messages.filter((m) =>
        (m.text || "").toLowerCase().includes(msgSearch.trim().toLowerCase())
      )
    : messages;

  // ✅ Handle sending message
  const handleSendMessage = async (text: string) => {
    if (!selectedThreadId) return;
    try {
      const newMsg = await sendClientThreadMessage(selectedThreadId, {
        text,
        replyToMessageId: replyTarget?.id,
      });
      setMessages((prev) => upsertMessage(prev, newMsg));
      setReplyTarget(null);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleSendFiles = async (files: File[]) => {
    if (!selectedThreadId) return;
    for (const file of files) {
      try {
        const msg = await sendClientThreadFile(selectedThreadId, file);
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
    if (!selectedThreadId) return;
    try {
      const msg = await sendClientThreadVoice(
        selectedThreadId,
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

  return (
    <ClientLayout brandSubtitle="Your Messages">
      <div className="flex gap-4 h-[calc(100vh-130px)] lg:gap-5 p-2">
        {/* Sidebar */}
        <div
          className={`${
            selectedThreadId ? "hidden sm:flex" : "flex"
          } w-full sm:w-72 lg:w-80 bg-white rounded-xl overflow-hidden flex-col border-2 border-gray-300 shadow-sm`}
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

          {/* Thread list */}
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
                  onClick={() => handleThreadSelect(thread.id)}
                  className={`w-full px-5 py-3.5 text-left border-b-2 border-gray-300 hover:bg-green-50/50 transition ${
                    selectedThreadId === thread.id
                      ? "bg-green-50/80 border-l-4 border-l-[#01411C]"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <ChatAvatar
                        name={thread.lawyer.name}
                        initials={thread.lawyer.initials}
                        avatarUrl={thread.lawyer.avatarUrl}
                        className="w-10 h-10 text-xs"
                      />
                      <div
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                          thread.lawyer.status === "online"
                            ? "bg-green-500"
                            : "bg-gray-400"
                        }`}
                      ></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 text-sm truncate">
                          {thread.lawyer.name}
                        </h3>
                        {thread.unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-1 flex items-center gap-1">
                        {thread.lastMessageKind === "voice" && (
                          <Mic className="h-3 w-3 flex-shrink-0" />
                        )}
                        {thread.lastMessageKind === "file" && (
                          <Paperclip className="h-3 w-3 flex-shrink-0" />
                        )}
                        <span className="truncate">{thread.lastMessage}</span>
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          thread.lawyer.status === "online"
                            ? "text-green-600 font-medium"
                            : "text-gray-500"
                        }`}
                      >
                        {thread.lawyer.status === "online"
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

        {/* Chat Area */}
        <div
          className={`${
            selectedThreadId ? "flex sm:flex" : "hidden sm:flex"
          } flex-1 bg-white rounded-xl overflow-hidden flex-row border-2 border-gray-300 shadow-sm relative`}
        >
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedThread ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-lg font-semibold mb-2">
                    Select a conversation
                  </p>
                  <p className="text-sm">
                    Choose a lawyer from the list to start messaging
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-white border-b-2 border-gray-300 px-5 py-4">
                  <div className="flex items-center gap-4">
                    {selectedThreadId && (
                      <button
                        onClick={handleThreadClear}
                        className="sm:hidden text-gray-600 hover:text-[#01411C] transition hover:bg-gray-100 p-1.5 rounded-lg"
                        title="Back"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </button>
                    )}
                    <div
                      className="relative cursor-pointer hover:opacity-80 transition"
                      onClick={() => setShowLawyerInfo(!showLawyerInfo)}
                    >
                      <ChatAvatar
                        name={selectedThread.lawyer.name}
                        initials={selectedThread.lawyer.initials}
                        avatarUrl={selectedThread.lawyer.avatarUrl}
                        className="w-11 h-11 text-sm shadow-sm"
                      />
                      <div
                        className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                          selectedThread.lawyer.status === "online"
                            ? "bg-green-500"
                            : "bg-gray-400"
                        }`}
                      ></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-bold text-gray-900">
                        {selectedThread.lawyer.name}
                      </h2>
                      {typingThreadId === selectedThreadId ? (
                        <p className="text-xs font-medium text-green-600">
                          typing…
                        </p>
                      ) : (
                        <p
                          className={`text-xs font-medium ${
                            selectedThread.lawyer.status === "online"
                              ? "text-green-600"
                              : "text-gray-500"
                          }`}
                        >
                          {selectedThread.lawyer.status === "online"
                            ? "● Online"
                            : `Last seen ${formatLastSeen(
                                selectedThread.lastMessageAt
                              )}`}
                        </p>
                      )}
                    </div>
                    <div className="relative hidden sm:block">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={msgSearch}
                        onChange={(e) => setMsgSearch(e.target.value)}
                        placeholder="Search in chat"
                        className="w-44 rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#01411C]/30 focus:border-[#01411C]"
                      />
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
                  <div className="flex-1 overflow-y-auto py-3 space-y-3 px-5 sm:px-8">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500 text-sm">
                          Loading messages...
                        </p>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500 text-center text-sm">
                          No messages yet. Start chatting!
                        </p>
                      </div>
                    ) : (
                      displayedMessages.map((msg, i) => {
                        const prev = displayedMessages[i - 1];
                        const showDate =
                          !prev || !isSameDay(prev.createdAt, msg.createdAt);
                        return (
                          <Fragment key={msg.id}>
                            {showDate && <ChatDateSeparator iso={msg.createdAt} />}
                            <ChatMessageBubble msg={msg} onReply={setReplyTarget} />
                          </Fragment>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="flex-shrink-0 border-t-2 border-gray-300">
                    <ChatComposer
                      onSend={handleSendMessage}
                      onSendFiles={handleSendFiles}
                      onSendVoice={handleSendVoice}
                      onTyping={(isTyping) =>
                        selectedThreadId &&
                        chatSocket.sendTyping(selectedThreadId, isTyping)
                      }
                      replyPreview={replyTarget ? messagePreview(replyTarget) : null}
                      onCancelReply={() => setReplyTarget(null)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Lawyer Info Sidebar */}
          {selectedThread && (
            <LawyerInfoSidebar
              thread={selectedThread}
              isOpen={showLawyerInfo}
              onClose={() => setShowLawyerInfo(false)}
              messages={messages}
            />
          )}
        </div>
      </div>
    </ClientLayout>
  );
}
