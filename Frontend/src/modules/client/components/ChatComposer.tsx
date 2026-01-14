import { Send } from "lucide-react";
import { useState } from "react";

interface ChatComposerProps {
  disabled?: boolean;
  onSend: (text: string) => void;
}

export default function ChatComposer({ disabled, onSend }: ChatComposerProps) {
  const [text, setText] = useState("");

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText("");
  };

  return (
    <div className="border-t bg-white p-4">
      <div className="flex items-center gap-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-green-700/40"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={disabled}
        />

        <button
          onClick={submit}
          disabled={disabled}
          className="rounded-lg bg-[#01411C] text-white p-2 hover:bg-green-800 disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
