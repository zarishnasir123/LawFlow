import { Plus, MessageSquare, Trash2 } from "lucide-react";

import type { AiChatSession } from "../data/aiGuidance";
import { formatDate } from "../../../shared/utils/formatDate";

type AiChatSidebarProps = {
  sessions: AiChatSession[];
  selectedSessionId: string | null;
  loading: boolean;
  onNewChat: () => void;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
};

// Left-pane conversation list for the AI assistant (ChatGPT-style). Presentational:
// the page owns the data (TanStack Query) and the selection/delete handlers.
export default function AiChatSidebar({
  sessions,
  selectedSessionId,
  loading,
  onNewChat,
  onSelect,
  onDelete,
}: AiChatSidebarProps) {
  return (
    <aside className="flex w-full sm:w-72 lg:w-80 flex-shrink-0 flex-col overflow-hidden rounded-xl border-2 border-gray-300 bg-white shadow-sm">
      <div className="border-b-2 border-gray-300 bg-gradient-to-r from-gray-50 to-white px-4 py-4">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#01411C] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#013317]"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-gray-500">Loading conversations…</div>
        ) : sessions.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No conversations yet. Ask a question to start one.
          </div>
        ) : (
          sessions.map((s) => {
            const active = s.id === selectedSessionId;
            return (
              <div
                key={s.id}
                className={`group flex items-center gap-2 border-b border-gray-200 px-3 py-3 transition ${
                  active ? "bg-green-50/80 border-l-4 border-l-[#01411C]" : "hover:bg-green-50/40"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <MessageSquare
                    className={`h-4 w-4 flex-shrink-0 ${active ? "text-[#01411C]" : "text-gray-400"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{s.title}</p>
                    <p className="text-xs text-gray-500">{formatDate(s.updatedAt, "relative")}</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  className="flex-shrink-0 rounded-md p-1.5 text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                  aria-label="Delete conversation"
                  title="Delete conversation"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
