import { useState, useRef, useEffect, Fragment } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { Send, Lightbulb, AlertCircle, Sparkles, ArrowUpRight } from "lucide-react";

import LawyerLayout from "../components/LawyerLayout";
import { useLoginStore } from "../../auth/store";
import { askAiLegalGuidance } from "../api";
import {
  type AiChatMessage,
  getInitialAiGuidanceMessages,
} from "../data/aiGuidance";
import { formatDate } from "../../../shared/utils/formatDate";

// Minimal, dependency-free renderer for the assistant's replies. The model
// returns light Markdown (**bold**, "* " / "- " bullets); without this the raw
// markers show literally. We only handle bold + bullet normalization and keep
// newlines via CSS `whitespace-pre-line`. No HTML is interpreted, so no XSS risk.
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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Auto-scroll to bottom when the conversation or suggestions change.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, suggestions, loading]);

  // Send a message. `text` lets a follow-up chip send directly without routing
  // through the input box; with no argument we use the composer's value.
  const send = async (text?: string) => {
    const prompt = (text ?? input).trim();
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
    setSuggestions([]);
    setLoading(true);

    try {
      const { message, suggestions: next } = await askAiLegalGuidance(prompt, history);
      setMessages((prev) => [...prev, message]);
      setSuggestions(next);
    } catch (err) {
      // Show the backend's real reason (e.g. "AI assistant is not configured",
      // "The assistant is busy right now", or a validation message) instead of a
      // generic line — it tells the lawyer whether to retry or fix something.
      const data = axios.isAxiosError(err)
        ? (err.response?.data as
            | { message?: string; errors?: { msg?: string }[] }
            | undefined)
        : undefined;
      const serverMessage =
        data?.message ||
        data?.errors?.[0]?.msg ||
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
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const canSend = !!input.trim() && !loading;

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle="AI Legal Assistant">
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Scrollable conversation, centered in a readable column */}
        <div
          className="flex-1 overflow-y-auto scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6">
            <div className="space-y-5">
              {messages.map((m) => {
                const isError = m.kind === "error";
                return (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {m.role === "ai" && (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 mr-3 ${
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

                    <div
                      className={`max-w-2xl rounded-2xl px-4 py-3 shadow-sm ${
                        m.role === "user"
                          ? "bg-[#01411C] text-white rounded-br-none"
                          : isError
                          ? "bg-amber-50 text-amber-900 border border-amber-200 rounded-bl-none"
                          : "bg-white text-gray-900 border border-gray-200 rounded-bl-none"
                      }`}
                    >
                      {m.kind === "intro" && m.role === "ai" && (
                        <div className="mb-2 pb-2 border-b border-gray-200">
                          <span className="text-sm font-semibold text-purple-700">
                            AI Assistant
                          </span>
                        </div>
                      )}

                      <p className="text-sm whitespace-pre-line leading-relaxed">
                        {m.role === "ai" && !isError ? renderRichText(m.text) : m.text}
                      </p>
                      <p
                        className={`text-[11px] mt-2 ${
                          m.role === "user"
                            ? "text-white/70"
                            : isError
                            ? "text-amber-700/80"
                            : "text-gray-400"
                        }`}
                      >
                        {m.time}
                      </p>
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
                  <div className="rounded-2xl rounded-bl-none px-4 py-3 bg-white border border-gray-200 shadow-sm">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" />
                    </span>
                  </div>
                </div>
              )}

              {/* Dynamic follow-up suggestions — appear after an answer, based on
                  what was just discussed. Clicking one sends it immediately. */}
              {!loading && suggestions.length > 0 && (
                <div className="pl-11 pt-1">
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-gray-500">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    Suggested follow-ups
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-white px-3.5 py-2 text-left text-sm text-purple-700 hover:bg-purple-50 hover:border-purple-300 transition-colors"
                      >
                        {s}
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Sticky composer */}
        <div className="sticky bottom-0 border-t border-gray-200 bg-white z-20">
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
                disabled={loading}
                placeholder={
                  loading
                    ? "Waiting for the assistant…"
                    : "Ask about your civil or family case (documents, procedure, drafting)…"
                }
                className="flex-1 rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#01411C] focus:ring-2 focus:ring-[#01411C]/20 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
              />

              <button
                type="button"
                onClick={() => send()}
                disabled={!canSend}
                className={`inline-flex items-center justify-center rounded-xl px-4 py-3 text-white transition flex-shrink-0 ${
                  canSend
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-purple-300 cursor-not-allowed"
                }`}
                aria-label="Send"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </LawyerLayout>
  );
}
