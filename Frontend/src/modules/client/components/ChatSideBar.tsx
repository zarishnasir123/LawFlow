import type { LawyerChatThread } from "../../../types/chat";

interface ChatSidebarProps {
  threads: LawyerChatThread[];
  selectedThreadId: string | null;
  search: string;
  onSearchChange: (v: string) => void;
  onSelectThread: (id: string) => void;
}

export default function ChatSidebar({
  threads,
  selectedThreadId,
  search,
  onSearchChange,
  onSelectThread,
}: ChatSidebarProps) {
  return (
    <aside className="w-full md:w-[360px] border-r border-gray-200 bg-white">
      <div className="p-4">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search conversations..."
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-700/30"
        />

        <div className="grid grid-cols-3 gap-3 mt-4">
          <StatCard label="Unread" value={threads.filter((t) => t.unreadCount > 0).length} />
          <StatCard label="Online" value={threads.filter((t) => t.client.status === "online").length} />
          <StatCard label="Total" value={threads.length} />
        </div>
      </div>

      <div className="px-2 pb-3">
        {threads.map((t) => {
          const active = t.id === selectedThreadId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectThread(t.id)}
              className={[
                "w-full text-left rounded-xl border px-3 py-3 mb-2 transition",
                active ? "border-green-700 bg-green-50" : "border-gray-200 hover:bg-gray-50",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-11 w-11 rounded-full bg-[#01411C] text-white flex items-center justify-center font-semibold">
                      {t.client.initials}
                    </div>
                    <span
                      className={[
                        "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white",
                        t.client.status === "online" ? "bg-green-500" : "bg-gray-400",
                      ].join(" ")}
                    />
                  </div>

                  <div>
                    <div className="font-semibold">{t.client.name}</div>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {t.lastMessage}
                    </div>
                    {t.caseId && (
                      <div className="text-[11px] text-gray-400 mt-1">Case: {t.caseId}</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="text-[11px] text-gray-500">
                    {new Date(t.lastMessageAt).toLocaleDateString()}
                  </div>
                  {t.unreadCount > 0 && (
                    <div className="h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[11px] flex items-center justify-center">
                      {t.unreadCount}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {t.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-gray-200 rounded-xl p-3 text-center">
      <div className="text-xl font-bold text-[#01411C]">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
