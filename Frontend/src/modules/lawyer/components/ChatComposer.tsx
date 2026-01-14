import { Send, Paperclip, Mic } from "lucide-react";
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
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="text-gray-600 hover:text-gray-800 transition"
          title="Attach file"
          disabled={disabled}
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-green-700/40"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          disabled={disabled}
        />

        <button
          type="button"
          className="text-gray-600 hover:text-gray-800 transition"
          title="Send voice message"
          disabled={disabled}
        >
          <Mic className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className="rounded-lg bg-green-700 text-white p-2 hover:bg-green-800 transition disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
