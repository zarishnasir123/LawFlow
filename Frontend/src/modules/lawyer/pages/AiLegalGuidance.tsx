import { useState, useRef, useEffect, Fragment } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { Send, Lightbulb, AlertCircle } from "lucide-react";

import LawyerLayout from "../components/LawyerLayout";
import { useLoginStore } from "../../auth/store";
import { askAiLegalGuidance } from "../api";
import {
  type AiChatMessage,
  aiGuidanceQuickSuggestions,
  getInitialAiGuidanceMessages,
} from "../data/aiGuidance";
import { formatDate } from "../../../shared/utils/formatDate";

// Minimal, dependency-free renderer for the assistant's replies. Gemini returns
// light Markdown (**bold**, "* " / "- " bullets); without this the raw markers
// show literally. We only handle bold + bullet normalization and keep newlines
// via CSS `whitespace-pre-line`. No HTML is interpreted, so there's no XSS risk.
function renderRichText(text: string): ReactNode {
  const normalized = text.replace(/^[ \t]*[*-][ \t]+/gm, "• ");
  return normalized.split(/\*\*(.+?)\*\*/g).map((segment, i) =>
    i % 2 === 1 ? (
      <strong key={i}>{segment}</strong>
    ) : (
      <Fragment key={i}>{segment}</Fragment>
    )
  );
}

export default function AiLegalGuidance() {
  const email = useLoginStore((state) => state.email);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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

    // Prior turns become context for the backend so follow-up questions keep
    // their thread. `messages` here is the conversation before this new prompt.
    const history = messages.map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const aiMsg = await askAiLegalGuidance(prompt, history);
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      // Show the backend's real reason (e.g. "AI assistant is not configured",
      // "The assistant is busy right now") instead of a generic message — it
      // tells the lawyer whether to retry or whether setup is incomplete.
      const serverMessage =
        (axios.isAxiosError(err) &&
          (err.response?.data as { message?: string } | undefined)?.message) ||
        "Couldn't reach the assistant. Check your connection and try again.";

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: "ai",
          text: serverMessage,
          time: formatDate(new Date(), "time"),
          kind: "error",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Show the starter prompts until the lawyer sends their first message.
  const showSuggestions = !messages.some((m) => m.role === "user");

  return (
    <LawyerLayout
      brandTitle="LawFlow"
      brandSubtitle="AI Legal Assistant"
    >
      <div className="h-screen flex flex-col">
        {/* Scrollable Messages Container - Hide Scrollbar, Full Width */}
        <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
            <div className="space-y-4">
              {messages.map((m) => {
                const isError = m.kind === "error";
                return (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "ai" && (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mr-3 ${
                        isError ? "bg-amber-500" : "bg-purple-600"
                      }`}
                    >
                      {isError ? (
                        <AlertCircle className="w-5 h-5" />
                      ) : (
                        <Lightbulb className="w-5 h-5" />
                      )}
                    </div>
                  )}

                  <div>
                    <div
                      className={`max-w-xl rounded-2xl p-4 ${
                        m.role === "user"
                          ? "bg-[#01411C] text-white rounded-br-none"
                          : isError
                          ? "bg-amber-50 text-amber-900 border-l-4 border-amber-500 rounded-bl-none"
                          : "bg-purple-100 text-gray-900 border-l-4 border-purple-600 rounded-bl-none"
                      }`}
                    >
                      {m.kind === "intro" && m.role === "ai" && (
                        <div className="mb-2 pb-2 border-b border-purple-300">
                          <span className="text-sm font-semibold text-purple-700">AI Assistant</span>
                        </div>
                      )}

                      <p className="text-sm whitespace-pre-line leading-relaxed">
                        {m.role === "ai" && !isError ? renderRichText(m.text) : m.text}
                      </p>
                      <p
                        className={`text-xs mt-2 ${
                          m.role === "user"
                            ? "text-white opacity-70"
                            : isError
                            ? "text-amber-700 opacity-80"
                            : "text-purple-700 opacity-75"
                        }`}
                      >
                        {m.time}
                      </p>
                    </div>
                  </div>

                  {m.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-[#01411C] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ml-3">
                      {lawyerName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white flex-shrink-0 mr-3">
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  <div className="rounded-2xl rounded-bl-none p-4 bg-purple-100 border-l-4 border-purple-600">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" />
                    </span>
                  </div>
                </div>
              )}
              
              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Quick Suggestions (only at start) */}
          {showSuggestions && (
            <div className="w-full px-4 sm:px-6 lg:px-8 pb-6">
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

          {/* Auto-scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Sticky Composer at Bottom - Full Width, Mobile Responsive */}
        <div className="sticky bottom-0 border-t border-gray-300 bg-white z-20 shadow-lg">
          <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                disabled={loading}
                placeholder={
                  loading
                    ? "Waiting for the assistant…"
                    : "Ask about your civil or family case (documents, procedure, drafting)…"
                }
                className="flex-1 rounded-lg sm:rounded-xl border-2 border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm outline-none focus:border-[#01411C] focus:ring-2 focus:ring-[#01411C]/20 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
              />

              <button
                type="button"
                onClick={send}
                disabled={!input.trim() || loading}
                className={`inline-flex items-center justify-center rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white transition flex-shrink-0 ${
                  !input.trim() || loading
                    ? "bg-purple-300 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-700"
                }`}
                aria-label="Send"
              >
                <Send className="h-4 sm:h-5 w-4 sm:w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </LawyerLayout>
  );
}
