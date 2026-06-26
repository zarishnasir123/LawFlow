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
  // Insert the AI reply at the lawyer's cursor (non-destructive). Returns false
  // if the caret isn't in the document yet (panel asks them to click in first).
  onInsertAtCursor: (text: string) => boolean;
  // Replace the document with the AI reply (destructive — confirmed in the panel).
  onReplaceDocument: (text: string) => boolean;
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
  onInsertAtCursor,
  onReplaceDocument,
  onClose,
}: AiDraftPanelProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Which AI reply is mid "Replace document?" confirmation.
  const [replaceConfirmId, setReplaceConfirmId] = useState<string | null>(null);
  // Which AI reply showed the "click in the document first" insert hint.
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

  // One-click: draft the COMPLETE plaint from the lawyer's typed facts. Requires
  // facts (the button is disabled until the box has text) so it never echoes the
  // blank template.
  const sendFullCase = () => {
    const story = input.trim();
    if (!story || sending || disabled) return;
    const history: AiDraftTurn[] = messages
      .filter((m) => m.kind !== "error")
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: "user",
        text: `Draft the entire case from these points:\n${story}`,
        time: formatDate(new Date(), "time"),
        kind: "message",
      },
    ]);
    setInput("");
    sendMutation.mutate({ instruction: story, history, mode: "full_case" });
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

  // Insert this AI reply at the lawyer's cursor (non-destructive). If the caret
  // isn't in the document, show the "click in the document first" hint.
  const insertAtCursor = (m: AiChatMessage) => {
    const ok = onInsertAtCursor(m.text);
    if (!ok) {
      setInsertNoticeId(m.id);
      setTimeout(() => setInsertNoticeId((cur) => (cur === m.id ? null : cur)), 3500);
    }
  };

  // Replace the document with this AI reply (confirmed via `replaceConfirmId`).
  const replaceDocument = (m: AiChatMessage) => {
    onReplaceDocument(m.text);
    setReplaceConfirmId(null);
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
              Type the client's story in points below, then I'll turn it into court-ready
              text. Review it, then Copy it, insert it at your cursor, or replace the document.
            </p>

            <button
              type="button"
              disabled={disabled || sending || !input.trim()}
              onClick={sendFullCase}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#01411C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#013317] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileText className="h-4 w-4" /> Draft the entire case
            </button>
            {!input.trim() && (
              <p className="mt-1.5 text-[11px] text-gray-400">
                Type the case facts below first, then draft the whole case.
              </p>
            )}
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
                        {/* Insert at cursor — non-destructive, the safe default */}
                        <button
                          type="button"
                          onClick={() => insertAtCursor(m)}
                          disabled={disabled}
                          title="Insert at your cursor in the document (keeps everything else)"
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[#01411C] transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ClipboardCopy className="h-3.5 w-3.5" /> Insert at cursor
                        </button>

                        {/* Replace document — destructive, two-step confirm */}
                        {replaceConfirmId === m.id ? (
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <span className="font-medium text-rose-600">Replace whole document?</span>
                            <button
                              type="button"
                              onClick={() => replaceDocument(m)}
                              disabled={disabled}
                              className="rounded-md bg-rose-600 px-2 py-1 font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Replace
                            </button>
                            <button
                              type="button"
                              onClick={() => setReplaceConfirmId(null)}
                              className="rounded-md px-2 py-1 font-medium text-gray-500 transition hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setReplaceConfirmId(m.id)}
                            disabled={disabled}
                            title="Replace the entire document with this draft (destructive)"
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <FileText className="h-3.5 w-3.5" /> Replace document
                          </button>
                        )}

                        {insertNoticeId === m.id && (
                          <span className="w-full text-[11px] text-amber-600">
                            Click where you want it in the document, then Insert.
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
            disabled={disabled || sending || !input.trim()}
            onClick={sendFullCase}
            title={!input.trim() ? "Type the case facts first" : "Draft the whole case"}
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
