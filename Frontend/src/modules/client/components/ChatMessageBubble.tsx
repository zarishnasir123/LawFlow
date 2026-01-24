import type { ChatMessage } from "../../../types/chat";
import { Phone } from "lucide-react";
import { useState } from "react";

interface ChatMessageBubbleProps {
  msg: ChatMessage;
}

export default function ChatMessageBubble({ msg }: ChatMessageBubbleProps) {
  const mine = msg.sender === "client"; // Right side for client
  const [dialpadNumber, setDialpadNumber] = useState<string | null>(null);

  // Detect phone numbers in text and make them clickable
  const renderMessageWithPhoneLinks = (text: string) => {
    const phoneRegex = /(\+?\d{1,3}[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}[\s.-]?\d{4,5}/g;
    const parts = text.split(phoneRegex);
    const matches = text.match(phoneRegex) || [];

    let matchIndex = 0;
    return parts.map((part, index) => {
      if (index % 2 === 0) {
        return <span key={index}>{part}</span>;
      } else {
        const phoneNumber = matches[matchIndex++];
        return (
          <button
            key={index}
            onClick={() => setDialpadNumber(phoneNumber)}
            className="text-blue-400 hover:text-blue-300 underline cursor-pointer mx-0.5 font-medium"
            title="Click to call"
          >
            {phoneNumber}
          </button>
        );
      }
    });
  };

  return (
    <>
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div
          className={[
            "max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg rounded-lg px-4 py-3 text-sm whitespace-pre-line",
            mine
              ? "bg-[#01411C] text-white" // client right
              : "bg-gray-50 border border-gray-200", // lawyer left
          ].join(" ")}
        >
          <div>{renderMessageWithPhoneLinks(msg.text)}</div>
          <div
            className={`mt-2 text-[11px] ${mine ? "text-green-200" : "text-gray-400"}`}
          >
            {new Date(msg.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>

      {/* Dialpad Modal */}
      {dialpadNumber && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Call</h2>
              <p className="text-gray-600 text-xs mb-4">Phone Number</p>
              <div className="text-4xl font-mono font-bold text-[#01411C] break-all">
                {dialpadNumber}
              </div>
            </div>

            {/* Dialpad Grid */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, "*", 0, "#"].map((digit) => (
                <button
                  key={digit}
                  onClick={() => console.log("Pressed:", digit)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold py-4 rounded-lg text-xl transition"
                >
                  {digit}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() =>
                  window.location.href = `tel:${dialpadNumber.replace(/[\s.-]/g, "")}`
                }
                className="flex-1 bg-[#01411C] hover:bg-green-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"
              >
                <Phone className="w-5 h-5" />
                Call
              </button>
              <button
                onClick={() => setDialpadNumber(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 font-bold py-3 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
