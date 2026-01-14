import type { ChatMessage } from "../../../types/chat";

export default function ChatMessageBubble({ msg }: { msg: ChatMessage }) {
  const mine = msg.sender === "client";

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-xs sm:max-w-md rounded-2xl px-4 py-3 text-sm",
          mine
            ? "bg-[#01411C] text-white"
            : "bg-white border border-gray-200",
        ].join(" ")}
      >
        <div>{msg.text}</div>

        <div
          className={`mt-1 text-[11px] ${
            mine ? "text-green-200" : "text-gray-400"
          }`}
        >
          {new Date(msg.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
