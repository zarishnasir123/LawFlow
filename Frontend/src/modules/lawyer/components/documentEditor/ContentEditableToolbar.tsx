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
  Download,
  Paperclip,
} from "lucide-react";
import clsx from "clsx";
import { alignSelectedImage, type ImageAlignMode } from "../../utils/floatingImage";

interface ContentEditableToolbarProps {
  // Utility actions live on the right side of the toolbar (Google Docs
  // pattern), so they're always next to formatting tools where the user
  // is already focused.
  onSaveDraft?: () => void;
  onDownload?: () => void;
  onAddAttachment?: () => void;
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
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200" />;
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
      {(onAddAttachment || onDownload || onSaveDraft) && (
        <>
          <div className="flex-1" />

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
          {onSaveDraft && (
            <ToolbarButton onClick={onSaveDraft} title="Save draft">
              <Save className="w-4 h-4" />
            </ToolbarButton>
          )}
        </>
      )}
    </div>
  );
}
