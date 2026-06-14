import { useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  MessageSquare,
  Pin,
  PinOff,
  Pencil,
  Trash2,
} from "lucide-react";

import type { AiChatSession } from "../data/aiGuidance";
import { formatDate } from "../../../shared/utils/formatDate";

type AiChatSidebarProps = {
  sessions: AiChatSession[];
  selectedSessionId: string | null;
  loading: boolean;
  onNewChat: () => void;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onRename: (sessionId: string, title: string) => void;
  onTogglePin: (sessionId: string, pinned: boolean) => void;
};

const DATE_BUCKET_ORDER = ["Today", "Yesterday", "Previous 7 Days", "Older"] as const;

// Which date bucket an updatedAt falls into (used for the unpinned groups).
function dateBucket(iso: string): (typeof DATE_BUCKET_ORDER)[number] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 86_400_000;
  const t = new Date(iso).getTime();
  if (t >= startOfToday) return "Today";
  if (t >= startOfToday - dayMs) return "Yesterday";
  if (t >= startOfToday - 7 * dayMs) return "Previous 7 Days";
  return "Older";
}

// Left-pane conversation list (ChatGPT-style): search, pinned group, date
// grouping, inline rename, pin toggle, and delete-with-confirm. Presentational —
// the page owns the data + mutation handlers; this manages only transient UI
// state (search text, the row being renamed, the row awaiting delete-confirm).
export default function AiChatSidebar({
  sessions,
  selectedSessionId,
  loading,
  onNewChat,
  onSelect,
  onDelete,
  onRename,
  onTogglePin,
}: AiChatSidebarProps) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  // Set when Escape cancels a rename, so the input's blur doesn't also commit it.
  const skipBlur = useRef(false);

  const startEdit = (s: AiChatSession) => {
    setConfirmingDeleteId(null);
    setEditingId(s.id);
    setDraft(s.title);
  };

  const commitEdit = () => {
    const id = editingId;
    if (!id) return;
    const value = draft.trim();
    setEditingId(null);
    const original = sessions.find((s) => s.id === id)?.title;
    if (value && value !== original) onRename(id, value);
  };

  const cancelEdit = () => {
    skipBlur.current = true;
    setEditingId(null);
  };

  // Filter by title, then split pinned vs. date-bucketed groups. Memoized so the
  // grouping only recomputes when the list or search changes.
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? sessions.filter((s) => s.title.toLowerCase().includes(q))
      : sessions;

    const out: { label: string; items: AiChatSession[] }[] = [];
    const pinned = filtered.filter((s) => s.pinned);
    if (pinned.length) out.push({ label: "Pinned", items: pinned });

    const unpinned = filtered.filter((s) => !s.pinned);
    for (const label of DATE_BUCKET_ORDER) {
      const items = unpinned.filter((s) => dateBucket(s.updatedAt) === label);
      if (items.length) out.push({ label, items });
    }
    return out;
  }, [sessions, search]);

  const renderRow = (s: AiChatSession) => {
    const active = s.id === selectedSessionId;

    if (s.id === editingId) {
      return (
        <div key={s.id} className="px-2 py-2.5 border-b border-gray-200">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelEdit();
              }
            }}
            onBlur={() => {
              if (skipBlur.current) {
                skipBlur.current = false;
                return;
              }
              commitEdit();
            }}
            maxLength={120}
            className="w-full rounded-md border-2 border-[#01411C] px-2 py-1 text-sm outline-none"
          />
        </div>
      );
    }

    if (s.id === confirmingDeleteId) {
      return (
        <div
          key={s.id}
          className="flex items-center gap-2 border-b border-gray-200 bg-red-50 px-3 py-2.5"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-red-800">
            Delete “{s.title}”?
          </span>
          <button
            type="button"
            onClick={() => {
              onDelete(s.id);
              setConfirmingDeleteId(null);
            }}
            className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDeleteId(null)}
            className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      );
    }

    return (
      <div
        key={s.id}
        className={`group flex items-center gap-1 border-b border-gray-200 px-2 py-2.5 transition ${
          active ? "bg-green-50/80 border-l-4 border-l-[#01411C]" : "hover:bg-green-50/40"
        }`}
      >
        <button
          type="button"
          onClick={() => onSelect(s.id)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          {s.pinned ? (
            <Pin className="h-4 w-4 flex-shrink-0 fill-[#01411C] text-[#01411C]" />
          ) : (
            <MessageSquare
              className={`h-4 w-4 flex-shrink-0 ${active ? "text-[#01411C]" : "text-gray-400"}`}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{s.title}</p>
            <p className="text-xs text-gray-500">{formatDate(s.updatedAt, "relative")}</p>
          </div>
        </button>

        <div className="flex flex-shrink-0 items-center opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onTogglePin(s.id, !s.pinned)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#01411C]"
            aria-label={s.pinned ? "Unpin conversation" : "Pin conversation"}
            title={s.pinned ? "Unpin" : "Pin"}
          >
            {s.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => startEdit(s)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#01411C]"
            aria-label="Rename conversation"
            title="Rename"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDeleteId(s.id)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Delete conversation"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <aside className="flex w-full sm:w-72 lg:w-80 flex-shrink-0 flex-col overflow-hidden rounded-xl border-2 border-gray-300 bg-white shadow-sm">
      <div className="space-y-3 border-b-2 border-gray-300 bg-gradient-to-r from-gray-50 to-white px-4 py-4">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#01411C] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#013317]"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full rounded-lg border-2 border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#01411C] focus:ring-2 focus:ring-[#01411C]/20"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-gray-500">Loading conversations…</div>
        ) : sessions.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No conversations yet. Ask a question to start one.
          </div>
        ) : groups.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No conversations match “{search}”.
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {group.label}
              </p>
              {group.items.map(renderRow)}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
