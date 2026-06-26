import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUp,
  Check,
  ClipboardCopy,
  CornerDownLeft,
  Copy,
  FileText,
  Scale,
  Sparkles,
  X,
} from "lucide-react";

import { draftCaseContent } from "../../api";
import type { AiChatMessage, AiDraftTurn } from "../../data/aiGuidance";
import { formatDate } from "../../../../shared/utils/formatDate";

interface AiDraftPanelProps {
  open: boolean;
  caseId: string;
  disabled: boolean;
  disabledReason?: string;
  // Inserts the (safe) HTML into the document at the caret. Returns false if
  // there's nowhere to insert yet (no rendered pages).
  onInsert: (html: string) => boolean;
  onClose: () => void;
}

// How many recent turns we send back as context for multi-turn refinement.
const HISTORY_LIMIT = 8;

const EXAMPLE_PROMPTS = [
  "Draft the numbered facts from these points: …",
  "Rewrite this in formal legal language: …",
  "Write the prayer / relief clause for this suit",
  "Summarize these facts into a short paragraph",
];

// Assistant avatar (Scale of Justice + Sparkles badge) — matches AiLegalGuidance.
function AiAvatar({ size = "sm" }: { size?: "sm" | "lg" }) {
  const box = size === "lg" ? "h-12 w-12" : "h-7 w-7";
  const main = size === "lg" ? "h-6 w-6" : "h-4 w-4";
  return (
    <div className={`relative shrink-0 ${box}`}>
      <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#01411C] to-[#0b6e34] text-white">
        <Scale className={main} />
      </div>
      <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-amber-900 ring-2 ring-white">
        <Sparkles className="h-2 w-2" />
      </span>
    </div>
  );
}

// Display-only renderer for the model's light Markdown (**bold** + bullets).
// No HTML is interpreted, so no XSS risk in the panel.
function renderRichText(text: string): ReactNode {
  const normalized = text.replace(/^[ \t]*[*-][ \t]+/gm, "• ");
  return normalized.split(/\*\*(.+?)\*\*/g).map((segment, i) =>
    i % 2 === 1 ? <strong key={i}>{segment}</strong> : <Fragment key={i}>{segment}</Fragment>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Escape, then apply the one inline marker we allow (**bold**).
function inline(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

// Convert the model's plain/light-Markdown draft into a SAFE HTML subset for
// insertion into the document: each line → its own <p> (so numbered plaint
// paragraphs stay separate), consecutive "- "/"* " lines → a <ul>. Only <p>,
// <strong>, <ul>, <li>, <br> ever reach the DOM.
function draftToHtml(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(`<ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`);
      bullets = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      bullets.push(inline(line.replace(/^[-*]\s+/, "")));
      continue;
    }
    flush();
    out.push(`<p>${inline(line)}</p>`);
  }
  flush();
  return out.join("") || `<p>${inline(text.trim())}</p>`;
}

function extractErrorMessage(err: unknown): string {
  const data = axios.isAxiosError(err)
    ? (err.response?.data as { message?: string; errors?: { msg?: string }[] } | undefined)
    : undefined;
  return (
    data?.message ||
    data?.errors?.[0]?.msg ||
    "Couldn't reach the assistant. Check your connection and try again."
  );
}

// ChatGPT-style drafting panel: the lawyer pastes his case points, the AI drafts
// court-ready text, and each AI reply can be Copied or Inserted into the document.
// Kept mounted (visibility toggled) so the conversation survives open/close.
export default function AiDraftPanel({
  open,
  caseId,
  disabled,
  disabledReason,
  onInsert,
  onClose,
}: AiDraftPanelProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [insertNoticeId, setInsertNoticeId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const sendMutation = useMutation({
    mutationFn: (vars: {
      instruction: string;
      history: AiDraftTurn[];
      mode?: "section" | "full_case";
    }) => draftCaseContent(caseId, vars.instruction, vars.history, vars.mode),
    onSuccess: (res) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "ai",
          text: res.draft,
          time: formatDate(new Date(), "time"),
          kind: "message",
        },
      ]);
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
    },
  });

  const sending = sendMutation.isPending;

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, open]);

  const send = (text?: string) => {
    const instruction = (text ?? input).trim();
    if (!instruction || sending || disabled) return;

    // Build context from the conversation so far (exclude error bubbles), capped.
    const history: AiDraftTurn[] = messages
      .filter((m) => m.kind !== "error")
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: "user",
        text: instruction,
        time: formatDate(new Date(), "time"),
        kind: "message",
      },
    ]);
    setInput("");
    sendMutation.mutate({ instruction, history });
  };

  // One-click: draft the COMPLETE plaint. Uses whatever points the lawyer has
  // typed (or the case details on file if the box is empty).
  const sendFullCase = () => {
    if (sending || disabled) return;
    const story = input.trim();
    const instruction = story || "Draft the complete case using the case details on file.";
    const history: AiDraftTurn[] = messages
      .filter((m) => m.kind !== "error")
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: "user",
        text: story ? `Draft the entire case from these points:\n${story}` : "Draft the entire case",
        time: formatDate(new Date(), "time"),
        kind: "message",
      },
    ]);
    setInput("");
    sendMutation.mutate({ instruction, history, mode: "full_case" });
  };

  const copy = async (m: AiChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.text);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId((cur) => (cur === m.id ? null : cur)), 1500);
    } catch {
      /* clipboard unavailable (insecure context) — ignore */
    }
  };

  const insert = (m: AiChatMessage) => {
    const ok = onInsert(draftToHtml(m.text));
    if (!ok) {
      setInsertNoticeId(m.id);
      setTimeout(() => setInsertNoticeId((cur) => (cur === m.id ? null : cur)), 3000);
    }
  };

  const canSend = !!input.trim() && !sending && !disabled;
  const showHero = messages.length === 0;

  return (
    <aside
      className={
        open
          ? "flex w-80 lg:w-96 flex-shrink-0 flex-col border-l border-gray-200 bg-white"
          : "hidden"
      }
      aria-hidden={!open}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <AiAvatar />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Draft with AI</p>
            <p className="text-[11px] text-gray-500">Turns your points into case text</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
          aria-label="Close AI panel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto bg-gray-50/70 px-3 py-4">
        {showHero ? (
          <div className="flex h-full flex-col items-center justify-center px-2 text-center">
            <AiAvatar size="lg" />
            <h3 className="mt-3 text-sm font-semibold text-gray-900">
              Draft your case from a few points
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Paste the client's story in points and I'll turn it into court-ready text —
              draft, paraphrase, expand, or summarize. Review, then Copy or Insert.
            </p>

            <button
              type="button"
              disabled={disabled || sending}
              onClick={sendFullCase}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#01411C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#013317] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileText className="h-4 w-4" /> Draft the entire case
            </button>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">
              or draft part by part
            </p>

            <div className="mt-2 w-full space-y-1.5">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={disabled}
                  onClick={() => setInput(p)}
                  className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs text-gray-600 transition-colors hover:border-[#01411C]/30 hover:bg-green-50/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => {
              const isError = m.kind === "error";
              const isAi = m.role === "ai";
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2 ${isAi ? "justify-start" : "justify-end"}`}
                >
                  {isAi &&
                    (isError ? (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                    ) : (
                      <AiAvatar />
                    ))}

                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      !isAi
                        ? "bg-[#01411C] text-white"
                        : isError
                        ? "border border-amber-200 bg-amber-50 text-amber-900"
                        : "border border-gray-200 bg-white text-gray-900 shadow-sm"
                    }`}
                  >
                    <p className="whitespace-pre-line text-[13px] leading-relaxed">
                      {isAi && !isError ? renderRichText(m.text) : m.text}
                    </p>

                    {isAi && !isError && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2">
                        <button
                          type="button"
                          onClick={() => copy(m)}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-green-600" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" /> Copy
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => insert(m)}
                          disabled={disabled}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[#01411C] transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ClipboardCopy className="h-3.5 w-3.5" /> Insert at cursor
                        </button>
                        {insertNoticeId === m.id && (
                          <span className="text-[11px] text-amber-600">
                            Click in the document first, then Insert.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex items-start gap-2">
                <AiAvatar />
                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 shadow-sm">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#01411C]/60 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 rounded-full bg-[#01411C]/60 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 rounded-full bg-[#01411C]/60 animate-bounce" />
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-white p-3">
        {disabled && (
          <p className="mb-2 rounded-md bg-gray-50 px-2.5 py-2 text-[11px] text-gray-500">
            {disabledReason || "This case can no longer be edited."}
          </p>
        )}
        {!showHero && (
          <button
            type="button"
            disabled={disabled || sending}
            onClick={sendFullCase}
            className="mb-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#01411C]/30 bg-green-50/60 px-3 py-2 text-xs font-semibold text-[#01411C] transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText className="h-3.5 w-3.5" /> Draft the entire case
          </button>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-gray-300 bg-white px-2 py-1.5 transition focus-within:border-[#01411C] focus-within:ring-2 focus-within:ring-[#01411C]/15">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={sending || disabled}
            rows={2}
            placeholder={
              disabled ? "Editing is locked for this case" : "Paste your case points…"
            }
            className="max-h-40 flex-1 resize-none bg-transparent px-1.5 py-1 text-[13px] outline-none disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={!canSend}
            className={`mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white transition ${
              canSend ? "bg-gradient-to-br from-[#01411C] to-[#0b6e34] hover:opacity-90" : "cursor-not-allowed bg-gray-300"
            }`}
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 flex items-center gap-1 px-1 text-[10px] text-gray-400">
          <CornerDownLeft className="h-3 w-3" /> Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </aside>
  );
}
