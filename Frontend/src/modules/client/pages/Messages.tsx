import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, User, LogOut, Search } from "lucide-react";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import type { ClientChatThread } from "../../../types/chat";
import { getClientThreads } from "../api"; // Client-side API

export default function ClientMessages() {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<ClientChatThread[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Load all threads for client
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

  // Filter threads by search
  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      return (
        t.lawyer.name.toLowerCase().includes(q) ||
        t.tags.join(" ").toLowerCase().includes(q) ||
        (t.caseId ?? "").toLowerCase().includes(q)
      );
    });
  }, [threads, search]);

  // Navigate to selected thread
  const selectThread = (threadId: string) => {
    navigate({ to: `/client-chat/${threadId}` });
  };

  return (
    <DashboardLayout
      brandTitle="LawFlow"
      brandSubtitle="Your Messages"
      actions={[
        { label: "Notifications", icon: Bell, onClick: () => navigate({ to: "/client-dashboard" }), badge: 3 },
        { label: "Profile", icon: User, onClick: () => navigate({ to: "/client-profile" }) },
        { label: "Logout", icon: LogOut, onClick: () => navigate({ to: "/login" }) },
      ]}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
        {/* Sidebar */}
        <div className="md:col-span-1 bg-white rounded-lg shadow flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversations</h2>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01411C]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading conversations...</div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {threads.length === 0 ? "No conversations yet" : "No matching conversations"}
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => selectThread(thread.id)}
                  className="w-full p-4 text-left border-b border-gray-100 hover:bg-green-50 active:bg-green-100 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#01411C] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {thread.lawyer.initials}
                        </div>
                        <h3 className="font-semibold text-gray-900 text-sm truncate">{thread.lawyer.name}</h3>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 truncate">{thread.lastMessage}</p>
                      {thread.caseId && <p className="text-xs text-gray-400 mt-1">{thread.caseId}</p>}
                    </div>
                    {thread.unreadCount > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-1 mt-2 flex-wrap">
                    {thread.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2 bg-white rounded-lg shadow flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="text-lg font-semibold mb-2">Select a conversation</p>
            <p className="text-sm">Choose a lawyer from the list to start messaging</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
