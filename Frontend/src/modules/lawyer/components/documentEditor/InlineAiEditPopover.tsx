import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Loader2, Sparkles, X } from "lucide-react";

import { editCaseSelection } from "../../api";

interface InlineAiEditPopoverProps {
  caseId: string;
  anchor: DOMRect; // the bounding rect of the current text selection (viewport coords)
  selectedText: string;
  // Replaces the selection in the document with `text`. Returns false if the
  // saved range went stale (nothing replaced).
  onApply: (text: string) => boolean;
  onClose: () => void;
}

const WIDTH = 340;
const QUICK_FIXES = [
  { label: "Fix grammar", query: "Fix all grammar and spelling mistakes." },
  { label: "Make formal", query: "Rewrite this in formal legal English." },
  { label: "Rephrase", query: "Rephrase this while keeping the same meaning." },
  { label: "Shorten", query: "Make this more concise without losing key facts." },
];

function extractErrorMessage(err: unknown): string {
  const data = axios.isAxiosError(err)
    ? (err.response?.data as { message?: string; errors?: { msg?: string }[] } | undefined)
    : undefined;
  return (
    data?.message ||
    data?.errors?.[0]?.msg ||
    "Couldn't reach the assistant. Try again."
  );
}

// Floating "Ask AI" box anchored above a text selection in the document. The
// lawyer types a query (or taps a quick fix); on success the selected text is
// replaced in place by onApply().
export default function InlineAiEditPopover({
  caseId,
  anchor,
  selectedText,
  onApply,
  onClose,
}: InlineAiEditPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const editMutation = useMutation({
    mutationFn: (instruction: string) =>
      editCaseSelection(caseId, instruction, selectedText),
    onSuccess: (res) => {
      const ok = onApply(res.draft);
      if (ok) onClose();
    },
  });
  const pending = editMutation.isPending;

  // Position computed from the selection rect during render (no measuring, so no
  // setState-in-effect). Prefer just above the selection; if there isn't room
  // above, go below — and ALWAYS clamp into the viewport so a tall (whole-page)
  // selection never pushes the box off-screen.
  const EST_HEIGHT = 200;
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - WIDTH - 8));
  const preferredTop =
    anchor.top >= EST_HEIGHT + 16 ? anchor.top - 8 - EST_HEIGHT : anchor.bottom + 8;
  const top = Math.max(8, Math.min(preferredTop, window.innerHeight - EST_HEIGHT - 8));
  const positionStyle = { top, left, width: WIDTH };

  // Focus the input on open.
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, []);

  // Close on Esc, outside-click, scroll, or resize (capture phase, like PageContextMenu).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onScrollOrResize = () => onClose();
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown, true);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [onClose]);

  const submit = (instruction: string) => {
    const q = instruction.trim();
    if (!q || pending) return;
    editMutation.mutate(q);
  };

  const preview =
    selectedText.length > 60 ? `${selectedText.slice(0, 60)}…` : selectedText;

  return (
    <div
      ref={ref}
      className="fixed z-[110] rounded-xl border border-gray-200 bg-white shadow-xl"
      style={positionStyle}
      // Keep the document selection intact when the lawyer clicks anywhere in the
      // box EXCEPT the text input (which needs focus to type).
      onMouseDown={(e) => {
        if (e.target !== inputRef.current) e.preventDefault();
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[#01411C]">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="truncate text-xs font-semibold">Edit with AI</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 py-2.5">
        <p className="mb-2 truncate text-[11px] text-gray-400">
          Editing: <span className="text-gray-600">"{preview}"</span>
        </p>

        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_FIXES.map((f) => (
            <button
              key={f.label}
              type="button"
              disabled={pending}
              onClick={() => submit(f.query)}
              className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-700 transition hover:border-[#01411C]/30 hover:bg-green-50 hover:text-[#01411C] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-1 transition focus-within:border-[#01411C] focus-within:ring-2 focus-within:ring-[#01411C]/15">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit(query);
              }
            }}
            disabled={pending}
            placeholder="Tell AI how to edit this — add a CNIC, name, date…"
            className="min-w-0 flex-1 bg-transparent px-1 py-1 text-[12px] outline-none disabled:cursor-not-allowed"
          />
          <button
            type="button"
            disabled={pending || !query.trim()}
            onClick={() => submit(query)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#01411C] text-white transition hover:bg-[#013317] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Apply"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </button>
        </div>

        {pending && (
          <p className="mt-2 text-[11px] text-gray-500">Editing the selected text…</p>
        )}
        {editMutation.isError && (
          <p className="mt-2 flex items-center gap-1 text-[11px] text-rose-600">
            <AlertCircle className="h-3.5 w-3.5" /> {extractErrorMessage(editMutation.error)}
          </p>
        )}
      </div>
    </div>
  );
}
