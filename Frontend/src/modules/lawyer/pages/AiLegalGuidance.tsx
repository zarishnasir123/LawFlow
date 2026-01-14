import { useState } from "react";
import { Send, AlertCircle, Lightbulb, Bell, User, LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import { useLoginStore } from "../../auth/store";
import { askAiLegalGuidance } from "../api";
import {
  type AiChatMessage,
  aiGuidanceQuickSuggestions,
  getInitialAiGuidanceMessages,
} from "../data/aiGuidance.mock.ts";
import { formatDate } from "../../../shared/utils/formatDate";

export default function AiLegalGuidance() {
  const navigate = useNavigate();
  const email = useLoginStore((state) => state.email);

  const lawyerName = (() => {
    if (!email) return "Counselor";
    const handle = email.split("@")[0] ?? "";
    if (!handle) return "Counselor";
    return handle
      .replace(/[._-]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  })();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AiChatMessage[]>(
    getInitialAiGuidanceMessages()
  );
  const [loading, setLoading] = useState(false);

  // Send message: adds user msg -> calls API -> adds AI msg
  const send = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;

    const userMsg: AiChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: prompt,
      time: formatDate(new Date(), "time"),
      kind: "message",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const aiMsg = await askAiLegalGuidance(prompt);
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setLoading(false);
    }
  };

  const showSuggestions = messages.length === 3;

  return (
    <DashboardLayout
      brandTitle="LawFlow"
      brandSubtitle="AI Legal Assistant"
      actions={[
        {
          label: "Notifications",
          icon: Bell,
          onClick: () => navigate({ to: "/Lawyer-dashboard" }),
          badge: 3,
        },
        {
          label: "Profile",
          icon: User,
          onClick: () => navigate({ to: "/Lawyer-dashboard" }),
        },
        {
          label: "Logout",
          icon: LogOut,
          onClick: () => navigate({ to: "/login" }),
        },
      ]}
    >
      <div className="space-y-4">
        {/* Messages Container */}
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="mb-6 pb-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Welcome, {lawyerName}</h3>
            <p className="text-sm text-gray-600">AI Legal Assistant - Get instant guidance</p>
          </div>

          <div className="space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "ai" && (
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mr-3">
                    <Lightbulb className="w-5 h-5" />
                  </div>
                )}
                
                <div>
                  <div
                    className={`max-w-2xl rounded-2xl p-4 ${
                      m.role === "user"
                        ? "bg-[#01411C] text-white rounded-br-none"
                        : "bg-purple-100 text-gray-900 border-l-4 border-purple-600 rounded-bl-none"
                    }`}
                  >
                    {m.kind === "intro" && m.role === "ai" && (
                      <div className="mb-2 pb-2 border-b border-purple-300">
                        <span className="text-sm font-semibold text-purple-700">AI Assistant</span>
                      </div>
                    )}

                    <p className="text-sm whitespace-pre-line leading-relaxed">{m.text}</p>
                    <p className={`text-xs mt-2 ${m.role === "user" ? "text-white opacity-70" : "text-purple-700 opacity-75"}`}>{m.time}</p>
                  </div>
                </div>

                {m.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-[#01411C] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ml-3">
                    {lawyerName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="max-w-2xl rounded-2xl p-4 bg-white border border-gray-200">
                  <p className="text-sm text-gray-600">AI is thinking…</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Suggestions (only at start) */}
        {showSuggestions && (
          <div className="max-w-4xl mx-auto px-4">
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-purple-600" />
                <h4 className="text-sm font-medium text-purple-900">Quick Suggestions</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {aiGuidanceQuickSuggestions.map((s: string) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInput(s)}
                    className="text-left px-3 py-2 bg-white border border-purple-200 rounded-xl text-sm text-purple-700 hover:bg-purple-100 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Notice */}
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-1">Important Notice</h4>
                <p className="text-xs text-blue-700">
                  AI guidance is for informational purposes only and does not constitute legal
                  advice. Always verify with relevant laws and precedents.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-gray-200 bg-white -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 py-4 mt-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask about legal procedures, documents, or case guidance…"
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#01411C]/40 focus:ring-2 focus:ring-[#01411C]/20"
              />

              <button
                type="button"
                onClick={send}
                disabled={!input.trim() || loading}
                className={`inline-flex items-center justify-center rounded-xl px-4 py-3 text-white transition ${
                  !input.trim() || loading
                    ? "bg-purple-300 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-700"
                }`}
                aria-label="Send"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Press Enter or click send to ask your question
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
