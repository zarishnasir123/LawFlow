import { ArrowLeft } from "lucide-react";
import type { ChatClient } from "../../../types/chat";

interface ChatHeaderProps {
  client: ChatClient | null;
  onBack: () => void;
}

export default function ChatHeader({ client, onBack }: ChatHeaderProps) {
  return (
    <header className="bg-[#01411C] text-white px-4 py-3 shadow-md flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="hover:bg-white/10 rounded-lg p-2 transition"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="leading-tight">
          <div className="font-semibold">LawFlow</div>
          <div className="text-xs text-green-100">
            {client ? `Chat with ${client.name}` : "Messages"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Future icons: notifications/profile/logout */}
        <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-sm">
          {client?.initials ?? "L"}
        </div>
      </div>
    </header>
  );
}
