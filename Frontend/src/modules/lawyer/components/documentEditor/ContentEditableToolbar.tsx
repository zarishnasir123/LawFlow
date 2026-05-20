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
} from "lucide-react";
import clsx from "clsx";

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
export default function ContentEditableToolbar() {
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

  return (
    // flex-shrink-0 keeps the toolbar at its natural height when the
    // editor column is constrained — critical inside the fixed-viewport
    // layout where the document area takes flex-1.
    <div className="flex flex-shrink-0 items-center gap-1 px-3 py-2 border-b border-gray-200 bg-white">
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
        onClick={() => exec("justifyLeft")}
        isActive={activeStates.justifyLeft}
        title="Align left"
      >
        <AlignLeft className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => exec("justifyCenter")}
        isActive={activeStates.justifyCenter}
        title="Align center"
      >
        <AlignCenter className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => exec("justifyRight")}
        isActive={activeStates.justifyRight}
        title="Align right"
      >
        <AlignRight className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => exec("justifyFull")}
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
    </div>
  );
}
