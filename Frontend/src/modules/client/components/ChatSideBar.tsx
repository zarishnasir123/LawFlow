import type { LawyerChatThread } from "../../../types/chat";

interface Props {
  threads: LawyerChatThread[];
  onSelect: (id: string) => void;
}

export default function ChatSidebar({ threads, onSelect }: Props) {
  return (
    <aside className="w-full md:w-80 border-r bg-white">
      <div className="p-4 font-semibold text-gray-900">My Chats</div>

      <div className="px-2">
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className="w-full text-left p-3 rounded-lg hover:bg-green-50 border mb-2"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#01411C] text-white flex items-center justify-center font-bold">
                {t.client.initials}
              </div>
              <div>
                <div className="font-semibold">{t.client.name}</div>
                <div className="text-xs text-gray-500 truncate">
                  {t.lastMessage}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
