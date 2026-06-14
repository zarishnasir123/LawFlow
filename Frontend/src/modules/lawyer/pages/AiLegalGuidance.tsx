import { useState, useRef, useEffect, Fragment } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Lightbulb,
  AlertCircle,
  Sparkles,
  ArrowUpRight,
  Copy,
  Check,
} from "lucide-react";

import LawyerLayout from "../components/LawyerLayout";
import AiChatSidebar from "../components/AiChatSidebar";
import { useCurrentUser, displayFullName } from "../../auth/hooks/useCurrentUser";
import {
  askAiLegalGuidance,
  deleteAiSession,
  getAiSession,
  listAiSessions,
  updateAiSession,
} from "../api";
import type { AiChatMessage } from "../data/aiGuidance";
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

function extractErrorMessage(err: unknown): string {
  const data = axios.isAxiosError(err)
    ? (err.response?.data as
        | { message?: string; errors?: { msg?: string }[] }
        | undefined)
    : undefined;
  return (
    data?.message ||
    data?.errors?.[0]?.msg ||
    "Couldn't reach the assistant. Check your connection and try again."
  );
}

export default function AiLegalGuidance() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Real logged-in user — drives the avatar + initial (shared ["currentUser"]
  // query, so it reflects profile-picture changes without extra fetching).
  const { data: currentUser } = useCurrentUser();
  const fullName = displayFullName(currentUser);
  const userInitial = (fullName.charAt(0) || "?").toUpperCase();

  const [input, setInput] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sidebar conversation list (server state).
  const sessionsQuery = useQuery({
    queryKey: ["lawyer", "ai-sessions"],
    queryFn: listAiSessions,
  });

  const activeTitle = selectedSessionId
    ? sessionsQuery.data?.find((s) => s.id === selectedSessionId)?.title ?? "Conversation"
    : "New conversation";

  const sendMutation = useMutation({
    mutationFn: (vars: { prompt: string; sessionId: string | null }) =>
      askAiLegalGuidance(vars.prompt, vars.sessionId ?? undefined),
    onSuccess: (res) => {
      setMessages((prev) => [...prev, res.message]);
      setSuggestions(res.suggestions);
      if (!selectedSessionId) setSelectedSessionId(res.sessionId);
      queryClient.invalidateQueries({ queryKey: ["lawyer", "ai-sessions"] });
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: "ai",
          text: extractErrorMessage(err),
          time: formatDate(new Date(), "time"),
          kind: "error",
        },
      ]);
      setSuggestions([]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => deleteAiSession(sessionId),
    onSuccess: (_data, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ["lawyer", "ai-sessions"] });
      if (sessionId === selectedSessionId) startNewChat();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { sessionId: string; patch: { title?: string; pinned?: boolean } }) =>
      updateAiSession(vars.sessionId, vars.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lawyer", "ai-sessions"] });
    },
  });

  const sending = sendMutation.isPending;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, suggestions, sending, loadingSession]);

  function startNewChat() {
    setSelectedSessionId(null);
    setMessages([]);
    setSuggestions([]);
    setInput("");
  }

  async function selectSession(sessionId: string) {
    if (sessionId === selectedSessionId || sending) return;
    setSelectedSessionId(sessionId);
    setSuggestions([]);
    setInput("");
    setLoadingSession(true);
    try {
      const detail = await getAiSession(sessionId);
      setMessages(
        detail.messages.map((m) => ({
          id: m.id,
          role: m.role,
          text: m.text,
          time: formatDate(m.createdAt, "time"),
          kind: "message" as const,
        }))
      );
    } catch {
      setMessages([
        {
          id: `ai-err-${Date.now()}`,
          role: "ai",
          text: "Couldn't load this conversation. Please try again.",
          time: formatDate(new Date(), "time"),
          kind: "error",
        },
      ]);
    } finally {
      setLoadingSession(false);
    }
  }

  const send = (text?: string) => {
    const prompt = (text ?? input).trim();
    if (!prompt || sending) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: "user",
        text: prompt,
        time: formatDate(new Date(), "time"),
        kind: "message",
      },
    ]);
    setInput("");
    setSuggestions([]);
    sendMutation.mutate({ prompt, sessionId: selectedSessionId });
  };

  const copyMessage = async (m: AiChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.text);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId((cur) => (cur === m.id ? null : cur)), 1500);
    } catch {
      // clipboard unavailable (insecure context) — silently ignore
    }
  };

  const canSend = !!input.trim() && !sending && !loadingSession;
  const showHero = messages.length === 0 && !sending && !loadingSession;

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle="AI Legal Assistant">
      {/* h-[calc(100vh-130px)] keeps the page within the viewport so the shared
          navbar stays put and only the inner panes scroll (mirrors Messages.tsx). */}
      <div className="flex gap-4 h-[calc(100vh-130px)] lg:gap-5">
        <div className="hidden sm:flex">
          <AiChatSidebar
            sessions={sessionsQuery.data ?? []}
            selectedSessionId={selectedSessionId}
            loading={sessionsQuery.isLoading}
            onNewChat={startNewChat}
            onSelect={selectSession}
            onDelete={(id) => deleteMutation.mutate(id)}
            onRename={(id, title) => updateMutation.mutate({ sessionId: id, patch: { title } })}
            onTogglePin={(id, pinned) =>
              updateMutation.mutate({ sessionId: id, patch: { pinned } })
            }
          />
        </div>

        {/* Chat pane */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border-2 border-gray-300 bg-white shadow-sm">
          {/* Pane header — assistant identity + active conversation title */}
          <div className="flex flex-shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 text-white">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{activeTitle}</p>
              <p className="text-xs text-gray-500">AI Legal Assistant · Pakistani civil &amp; family law</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className="mx-auto h-full w-full max-w-3xl px-4 sm:px-6 py-6">
              {loadingSession ? (
                <div className="py-10 text-center text-sm text-gray-500">
                  Loading conversation…
                </div>
              ) : showHero ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-100">
                    <Lightbulb className="h-8 w-8 text-purple-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    How can I help with your case?
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-gray-500">
                    Ask about a civil or family suit — choosing the right template, required
                    documents, procedure, or drafting. Grounded in Pakistani law.
                  </p>
                </div>
              ) : (
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
                          <p className="text-sm whitespace-pre-line leading-relaxed">
                            {m.role === "ai" && !isError ? renderRichText(m.text) : m.text}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <span
                              className={`text-[11px] ${
                                m.role === "user"
                                  ? "text-white/70"
                                  : isError
                                  ? "text-amber-700/80"
                                  : "text-gray-400"
                              }`}
                            >
                              {m.time}
                            </span>
                            {m.role === "ai" && !isError && (
                              <button
                                type="button"
                                onClick={() => copyMessage(m)}
                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                                aria-label="Copy answer"
                                title="Copy answer"
                              >
                                {copiedId === m.id ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-green-600" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" />
                                    Copy
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {m.role === "user" &&
                          (currentUser?.avatarUrl ? (
                            <img
                              src={currentUser.avatarUrl}
                              alt={fullName || "You"}
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0 ml-3"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#01411C] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ml-3">
                              {userInitial}
                            </div>
                          ))}
                      </div>
                    );
                  })}

                  {sending && (
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

                  {!sending && suggestions.length > 0 && (
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

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-white">
            <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") send();
                  }}
                  disabled={sending || loadingSession}
                  placeholder={
                    sending
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
      </div>
    </LawyerLayout>
  );
}
