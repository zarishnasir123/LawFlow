import { useEffect, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  RemoveFormatting,
  Type,
  Save,
  Check,
  Loader2,
  Download,
  Paperclip,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import { alignSelectedImage, type ImageAlignMode } from "../../utils/floatingImage";

interface ContentEditableToolbarProps {
  // Utility actions live on the right side of the toolbar (Google Docs
  // pattern), so they're always next to formatting tools where the user
  // is already focused.
  onSaveDraft?: () => void | Promise<void>;
  onDownload?: () => void;
  onAddAttachment?: () => void;
  // Word-style AutoSave switch. When on, the editor persists edits as the
  // lawyer types (wired in CaseDocumentEditor); when off, only Save draft
  // persists. Rendered only when onToggleAutoSave is provided.
  autoSave?: boolean;
  onToggleAutoSave?: () => void;
  // Opens/closes the AI drafting panel (wired in CaseDocumentEditor). Rendered
  // only when provided. `aiDraftOpen` lights the button while the panel is open.
  onToggleAiDraft?: () => void;
  aiDraftOpen?: boolean;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, title, disabled, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      // Prevent the button click from stealing focus from the editor — if
      // focus moves out of the contenteditable surface, execCommand has
      // no caret to apply formatting to. onMouseDown.preventDefault keeps
      // the selection intact across the click.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        "p-1.5 rounded-md transition-colors",
        isActive
          ? "bg-[var(--primary)] text-white shadow-sm"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200" />;
}

// Word-style AutoSave switch: a label plus a sliding pill toggle. When on,
// the editor saves as the lawyer types (the actual save loop lives in
// CaseDocumentEditor); when off, only the manual Save draft button persists.
function AutoSaveToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      // Keep the caret in the contenteditable surface across the click.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
      role="switch"
      aria-checked={enabled}
      title={
        enabled
          ? "AutoSave is on — changes save as you type. Click to turn off."
          : "AutoSave is off — use Save draft to persist. Click to turn on."
      }
      className={clsx(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[12.5px] font-medium transition-colors cursor-pointer",
        enabled
          ? "text-emerald-700 hover:bg-emerald-50"
          : "text-gray-500 hover:bg-gray-100"
      )}
    >
      <span className="hidden sm:inline">AutoSave</span>
      <span
        className={clsx(
          "relative inline-flex h-4 w-7 items-center rounded-full transition-colors",
          enabled ? "bg-emerald-500" : "bg-gray-300"
        )}
      >
        <span
          className={clsx(
            "inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-3.5" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}

// Save-draft button with transient feedback. Hovering shows a pointer
// cursor; clicking flips to a spinner ("Saving…") and then a green check
// ("Saved") for a beat, so the lawyer gets a clear, local confirmation that
// their work persisted. The header's "Last edited" caption updates too, but
// that's easy to miss while focused on the page.
function SaveDraftButton({ onSave }: { onSave: () => void | Promise<void> }) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    if (state !== "saved") return;
    const t = window.setTimeout(() => setState("idle"), 1800);
    return () => window.clearTimeout(t);
  }, [state]);

  const handleClick = async () => {
    if (state === "saving") return;
    setState("saving");
    try {
      await onSave();
      setState("saved");
    } catch {
      // Save failed — drop back to idle so the lawyer can retry. The
      // underlying saver surfaces its own error; we just avoid a false
      // "Saved" confirmation.
      setState("idle");
    }
  };

  const label =
    state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save draft";

  return (
    <button
      type="button"
      // Keep the caret inside the contenteditable surface across the click,
      // same as the formatting buttons.
      onMouseDown={(e) => e.preventDefault()}
      onClick={handleClick}
      disabled={state === "saving"}
      title={label}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
        state === "saved"
          ? "bg-emerald-50 text-emerald-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        state === "saving" ? "cursor-wait" : "cursor-pointer"
      )}
    >
      {state === "saving" ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : state === "saved" ? (
        <Check className="w-4 h-4" />
      ) : (
        <Save className="w-4 h-4" />
      )}
      {state !== "idle" && <span>{label}</span>}
    </button>
  );
}

// Lightweight contenteditable toolbar. Uses document.execCommand which is
// formally deprecated in the standard but is still the only one-liner that
// applies inline formatting (bold/italic/heading/list/align) to whatever
// is selected inside a contenteditable element. Alternative is to
// hand-roll selection manipulation via Selection/Range — overkill for an
// FYP-scale editor.
export default function ContentEditableToolbar({
  onSaveDraft,
  onDownload,
  onAddAttachment,
  autoSave,
  onToggleAutoSave,
  onToggleAiDraft,
  aiDraftOpen,
}: ContentEditableToolbarProps = {}) {
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});

  // Poll the current command states once per selection change so the
  // toolbar buttons highlight what's currently active (e.g., bold pill
  // lights up when the caret is inside a <strong>). Polling on
  // selectionchange is the canonical pattern; React doesn't have a
  // first-class hook for it.
  useEffect(() => {
    const refresh = () => {
      const commands = [
        "bold",
        "italic",
        "underline",
        "strikeThrough",
        "insertUnorderedList",
        "insertOrderedList",
        "justifyLeft",
        "justifyCenter",
        "justifyRight",
        "justifyFull",
      ];
      const next: Record<string, boolean> = {};
      commands.forEach((cmd) => {
        try {
          next[cmd] = document.queryCommandState(cmd);
        } catch {
          next[cmd] = false;
        }
      });
      setActiveStates(next);
    };
    document.addEventListener("selectionchange", refresh);
    return () => document.removeEventListener("selectionchange", refresh);
  }, []);

  const exec = (command: string, value?: string) => {
    // execCommand requires a selection inside a contenteditable element.
    // If the caret has drifted out (e.g., into the sidebar), the command
    // silently no-ops — that's the right behaviour, no extra guard needed.
    document.execCommand(command, false, value);
  };

  // Alignment buttons do double duty: if a floating image is currently
  // selected, the button repositions the image inside its page (left
  // edge / centered / right edge / stretched to full width). Otherwise
  // it falls through to execCommand on whatever text the caret is in.
  // We try the image path first; alignSelectedImage returns false if no
  // image is selected, in which case we run the text command.
  const align = (mode: ImageAlignMode, command: string) => {
    if (alignSelectedImage(mode)) return;
    exec(command);
  };

  return (
    // flex-shrink-0 keeps the toolbar at its natural height when the
    // editor column is constrained — critical inside the fixed-viewport
    // layout where the document area takes flex-1.
    <div className="flex flex-shrink-0 items-center gap-1 px-3 py-1.5 border-b border-gray-200 bg-gray-50/60">
      <ToolbarButton onClick={() => exec("undo")} title="Undo (Ctrl+Z)">
        <Undo className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("redo")} title="Redo (Ctrl+Y)">
        <Redo className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => exec("bold")}
        isActive={activeStates.bold}
        title="Bold (Ctrl+B)"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => exec("italic")}
        isActive={activeStates.italic}
        title="Italic (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => exec("underline")}
        isActive={activeStates.underline}
        title="Underline (Ctrl+U)"
      >
        <Underline className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => exec("strikeThrough")}
        isActive={activeStates.strikeThrough}
        title="Strikethrough"
      >
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => exec("formatBlock", "<h1>")}
        title="Heading 1"
      >
        <Heading1 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => exec("formatBlock", "<h2>")}
        title="Heading 2"
      >
        <Heading2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => exec("formatBlock", "<h3>")}
        title="Heading 3"
      >
        <Heading3 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => exec("formatBlock", "<p>")}
        title="Paragraph"
      >
        <Type className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => exec("insertUnorderedList")}
        isActive={activeStates.insertUnorderedList}
        title="Bullet list"
      >
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => exec("insertOrderedList")}
        isActive={activeStates.insertOrderedList}
        title="Numbered list"
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => align("left", "justifyLeft")}
        isActive={activeStates.justifyLeft}
        title="Align left"
      >
        <AlignLeft className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => align("center", "justifyCenter")}
        isActive={activeStates.justifyCenter}
        title="Align center"
      >
        <AlignCenter className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => align("right", "justifyRight")}
        isActive={activeStates.justifyRight}
        title="Align right"
      >
        <AlignRight className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => align("justify", "justifyFull")}
        isActive={activeStates.justifyFull}
        title="Justify"
      >
        <AlignJustify className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => exec("removeFormat")}
        title="Clear formatting"
      >
        <RemoveFormatting className="w-4 h-4" />
      </ToolbarButton>

      {/* Utility cluster, right-aligned. The flex-1 spacer pushes the
          remaining buttons to the right edge — Google Docs pattern of
          formatting tools on the left, file actions on the right. */}
      {(onToggleAiDraft || onToggleAutoSave || onAddAttachment || onDownload || onSaveDraft) && (
        <>
          <div className="flex-1" />

          {onToggleAiDraft && (
            <>
              <button
                type="button"
                // Keep the caret inside the contenteditable surface across the
                // click so the saved selection survives for "Insert at cursor".
                onMouseDown={(e) => e.preventDefault()}
                onClick={onToggleAiDraft}
                title="Draft with AI — turn your case points into court-ready text"
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors cursor-pointer",
                  aiDraftOpen
                    ? "bg-[var(--primary)] text-white shadow-sm"
                    : "text-[#01411C] hover:bg-green-50"
                )}
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Draft with AI</span>
              </button>
              <Divider />
            </>
          )}

          {onToggleAutoSave && (
            <AutoSaveToggle
              enabled={Boolean(autoSave)}
              onToggle={onToggleAutoSave}
            />
          )}
          {onToggleAutoSave && (onAddAttachment || onDownload || onSaveDraft) && (
            <Divider />
          )}

          {onAddAttachment && (
            <ToolbarButton onClick={onAddAttachment} title="Add attachment (PNG/JPG evidence photo)">
              <Paperclip className="w-4 h-4" />
            </ToolbarButton>
          )}
          {onAddAttachment && (onDownload || onSaveDraft) && <Divider />}
          {onDownload && (
            <ToolbarButton onClick={onDownload} title="Download document">
              <Download className="w-4 h-4" />
            </ToolbarButton>
          )}
          {onSaveDraft && <SaveDraftButton onSave={onSaveDraft} />}
        </>
      )}
    </div>
  );
}
