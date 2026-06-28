import { useEffect, useRef } from "react";
import { Check, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import type { PolishMode } from "../../api";

export type AiPolishStatus = "loading" | "ready" | "error" | "nochange";

interface AiPolishPopoverProps {
  // Viewport rect of the highlighted text — the popover anchors to it.
  anchorRect: { top: number; bottom: number; left: number };
  mode: PolishMode;
  original: string;
  status: AiPolishStatus;
  corrected: string;
  errorMessage?: string;
  onAccept: () => void;
  onDiscard: () => void;
  onRetry: () => void;
}

const MODE_LABEL: Record<PolishMode, string> = {
  grammar: "Fix grammar & spelling",
  formal: "Formal legal English",
};

// LawFlow brand green.
const BRAND = "#01411C";

// Before/after preview for one AI Language Polish suggestion, anchored to the
// lawyer's text selection. Modeled on PageContextMenu: fixed-position,
// edge-clamped, closes on Escape / outside-click — but deliberately NOT on
// scroll, so the lawyer can scroll the document while comparing the two
// versions. Every control preventDefaults its mousedown (same trick the toolbar
// buttons use) so clicking inside the popover never blurs the editor.
export default function AiPolishPopover({
  anchorRect,
  mode,
  original,
  status,
  corrected,
  errorMessage,
  onAccept,
  onDiscard,
  onRetry,
}: AiPolishPopoverProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!cardRef.current) return;
      if (!cardRef.current.contains(e.target as Node)) onDiscard();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDiscard();
    };
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onDiscard]);

  // Keep the card on-screen. Prefer just below the selection; flip above when
  // there isn't room. A fixed worst-case height drives the clamp; shorter
  // states (loading) simply leave a little extra gap below.
  const PAD = 8;
  const W = 380;
  const EST_H = 340;
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const placeAbove = spaceBelow < EST_H + PAD && anchorRect.top > spaceBelow;
  const top = placeAbove
    ? Math.max(PAD, anchorRect.top - EST_H - PAD)
    : Math.min(anchorRect.bottom + PAD, window.innerHeight - EST_H - PAD);
  const left = Math.min(Math.max(PAD, anchorRect.left), window.innerWidth - W - PAD);

  return (
    <div
      ref={cardRef}
      className="fixed z-[130] flex flex-col rounded-xl border border-gray-200 bg-white shadow-xl"
      style={{ top, left, width: W, maxHeight: EST_H }}
      role="dialog"
      aria-label="AI Refine suggestion"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-3.5 py-2.5">
        <Sparkles className="h-4 w-4" style={{ color: BRAND }} />
        <span className="flex-1 text-[13px] font-semibold text-gray-800">
          {MODE_LABEL[mode]}
        </span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onDiscard}
          title="Close"
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3">
        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: BRAND }} />
            Refining your text…
          </div>
        )}

        {status === "error" && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700">
            {errorMessage || "Couldn't reach the assistant. Please try again."}
          </div>
        )}

        {status === "nochange" && (
          <div className="flex items-center gap-2 py-4 text-[13px] text-gray-600">
            <Check className="h-4 w-4 text-emerald-600" />
            No changes needed — this text already reads well.
          </div>
        )}

        {status === "ready" && (
          <div className="space-y-2.5">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Original
              </p>
              <p className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-[13px] leading-relaxed text-gray-600">
                {original}
              </p>
            </div>
            <div>
              <p
                className="mb-1 text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: BRAND }}
              >
                Suggested
              </p>
              <p className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-[13px] leading-relaxed text-gray-900">
                {corrected}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-3.5 py-2.5">
        {status === "ready" && (
          <>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onDiscard}
              className="rounded-md px-3 py-1.5 text-[13px] font-medium text-gray-600 hover:bg-gray-100"
            >
              Discard
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onAccept}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: BRAND }}
            >
              <Check className="h-3.5 w-3.5" />
              Accept
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onDiscard}
              className="rounded-md px-3 py-1.5 text-[13px] font-medium text-gray-600 hover:bg-gray-100"
            >
              Discard
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: BRAND }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </button>
          </>
        )}

        {status === "nochange" && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onDiscard}
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-gray-600 hover:bg-gray-100"
          >
            Dismiss
          </button>
        )}

        {status === "loading" && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onDiscard}
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
