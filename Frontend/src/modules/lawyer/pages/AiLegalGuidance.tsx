import { useState, useRef, useEffect, Fragment } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  Scale,
  Sparkles,
  Lightbulb,
  AlertCircle,
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

// The assistant's avatar: a Scale of Justice (legal) on a gradient circle, with
// a small Sparkles badge as the "AI" hint. Used in the header, each answer, the
// typing indicator, and the welcome hero.
function AiAvatar({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "h-14 w-14" : size === "md" ? "h-8 w-8" : "h-7 w-7";
  const main = size === "lg" ? "h-7 w-7" : "h-4 w-4";
  const badge = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  const spark = size === "lg" ? "h-3 w-3" : "h-2 w-2";
  return (
    <div className={`relative shrink-0 ${box}`}>
      <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#01411C] to-[#0b6e34] text-white">
        <Scale className={main} />
      </div>
      <span
        className={`absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-amber-400 text-amber-900 ring-2 ring-white ${badge}`}
      >
        <Sparkles className={spark} />
      </span>
    </div>
  );
}

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
      <div className="flex gap-3 h-[calc(100vh-130px)] lg:gap-4">
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
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Pane header — assistant identity + active conversation title */}
          <div className="flex flex-shrink-0 items-center gap-2.5 border-b border-gray-100 bg-white px-4 py-2.5">
            <AiAvatar size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{activeTitle}</p>
              <p className="text-[11px] text-gray-500">
                AI Legal Assistant · Pakistani civil &amp; family law
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50/70">
            <div className="mx-auto h-full w-full max-w-3xl px-4 sm:px-6 py-5">
              {loadingSession ? (
                <div className="py-10 text-center text-sm text-gray-500">
                  Loading conversation…
                </div>
              ) : showHero ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4">
                    <AiAvatar size="lg" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    How can I help with your case?
                  </h2>
                  <p className="mt-1.5 max-w-md text-sm text-gray-500">
                    Ask about a civil or family suit — choosing the right template, required
                    documents, procedure, or drafting. Grounded in Pakistani law.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m) => {
                    const isError = m.kind === "error";
                    return (
                      <div
                        key={m.id}
                        className={`flex items-end gap-2.5 ${
                          m.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {m.role === "ai" &&
                          (isError ? (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                              <AlertCircle className="h-4 w-4" />
                            </div>
                          ) : (
                            <AiAvatar size="sm" />
                          ))}

                        <div
                          className={`max-w-2xl rounded-2xl px-3.5 py-2.5 ${
                            m.role === "user"
                              ? "bg-[#01411C] text-white shadow-sm"
                              : isError
                              ? "border border-amber-200 bg-amber-50 text-amber-900"
                              : "border border-gray-200/80 bg-white text-gray-900 shadow-[0_1px_3px_rgba(16,24,40,0.06)]"
                          }`}
                        >
                          <p className="whitespace-pre-line text-sm leading-relaxed">
                            {m.role === "ai" && !isError ? renderRichText(m.text) : m.text}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
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
                              className="h-7 w-7 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#01411C] text-[11px] font-bold text-white">
                              {userInitial}
                            </div>
                          ))}
                      </div>
                    );
                  })}

                  {sending && (
                    <div className="flex items-end gap-2.5">
                      <AiAvatar size="sm" />
                      <div className="rounded-2xl border border-gray-200/80 bg-white px-3.5 py-3 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-[#01411C]/60 animate-bounce [animation-delay:-0.3s]" />
                          <span className="h-2 w-2 rounded-full bg-[#01411C]/60 animate-bounce [animation-delay:-0.15s]" />
                          <span className="h-2 w-2 rounded-full bg-[#01411C]/60 animate-bounce" />
                        </span>
                      </div>
                    </div>
                  )}

                  {!sending && suggestions.length > 0 && (
                    <div className="pl-[38px] pt-0.5">
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-500">
                        <Lightbulb className="h-3.5 w-3.5 text-[#01411C]" />
                        Suggested follow-ups
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => send(s)}
                            className="group inline-flex items-center gap-1.5 rounded-full border border-[#01411C]/25 bg-white px-3 py-1.5 text-left text-sm text-[#01411C] transition-colors hover:border-[#01411C]/40 hover:bg-green-50"
                          >
                            {s}
                            <ArrowUpRight className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
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

          {/* Composer — single rounded pill wrapping input + send */}
          <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-3 sm:px-6">
            <div className="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-2xl border border-gray-300 bg-white px-2 py-1.5 shadow-sm transition focus-within:border-[#01411C] focus-within:ring-2 focus-within:ring-[#01411C]/15">
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
                    : "Ask about your civil or family case…"
                }
                className="flex-1 bg-transparent px-2 py-2 text-sm outline-none disabled:cursor-not-allowed"
              />

              <button
                type="button"
                onClick={() => send()}
                disabled={!canSend}
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white transition ${
                  canSend
                    ? "bg-gradient-to-br from-[#01411C] to-[#0b6e34] hover:opacity-90"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
                aria-label="Send"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </LawyerLayout>
  );
}
