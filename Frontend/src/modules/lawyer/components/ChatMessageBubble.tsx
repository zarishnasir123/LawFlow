import type { ChatMessage } from "../../../types/chat";

export default function ChatMessageBubble({ msg }: { msg: ChatMessage }) {
  const mine = msg.sender === "lawyer";

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg rounded-2xl px-4 py-3 text-sm whitespace-pre-line",
          mine ? "bg-[#01411C] text-white" : "bg-white border border-gray-200",
        ].join(" ")}
      >
        <div>{msg.text}</div>
        <div className={`mt-2 text-[11px] ${mine ? "text-green-200" : "text-gray-400"}`}>
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
