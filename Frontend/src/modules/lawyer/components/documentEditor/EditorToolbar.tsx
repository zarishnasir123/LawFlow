import { Editor } from "@tiptap/react";
import { useState, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Table,
  Quote,
  Minus,
  Undo,
  Redo,
  RemoveFormatting,
  Trash2,
  Columns as ColumnsIcon,
  Rows as RowsIcon,
  Merge as MergeIcon,
  Split as SplitIcon,
} from "lucide-react";
import clsx from "clsx";

interface EditorToolbarProps {
  editor: Editor | null;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  disabled?: boolean;
  className?: string;
}

function ToolbarButton({
  onClick,
  isActive,
  icon: Icon,
  title,
  disabled,
  className,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={clsx(
        "p-2 rounded-md transition-all duration-200 relative group",
        disabled
          ? "opacity-40 cursor-not-allowed hidden"
          : isActive
            ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-200"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        className
      )}
    >
      <Icon className={clsx("w-4 h-4", isActive && "stroke-[3px]")} />
      {/* Tooltip */}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10">
        {title}
      </span>
    </button>
  );
}

export default function EditorToolbar({ editor }: EditorToolbarProps) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      forceUpdate((prev) => prev + 1);
    };

    editor.on("transaction", handleUpdate);
    editor.on("selectionUpdate", handleUpdate);

    return () => {
      editor.off("transaction", handleUpdate);
      editor.off("selectionUpdate", handleUpdate);
    };
  }, [editor]);

  if (!editor) return null;

  const insertTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  const insertHorizontalRule = () => {
    editor.chain().focus().setHorizontalRule().run();
  };

  const isTableActive = editor.isActive('table');

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap gap-1 items-center sticky top-0 z-20">
      {/* Undo/Redo */}
      <div className="flex gap-0.5 pr-2 border-r border-gray-200">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          icon={Undo}
          title="Undo (Ctrl+Z)"
          disabled={!editor.can().undo()}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          icon={Redo}
          title="Redo (Ctrl+Y)"
          disabled={!editor.can().redo()}
        />
      </div>

      {/* Text Formatting */}
      <div className="flex gap-0.5 px-2 border-r border-gray-200">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          icon={Bold}
          title="Bold (Ctrl+B)"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          icon={Italic}
          title="Italic (Ctrl+I)"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          icon={Underline}
          title="Underline (Ctrl+U)"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          icon={Strikethrough}
          title="Strikethrough"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive("code")}
          icon={Code}
          title="Inline Code"
        />
      </div>

      {/* Headings */}
      <div className="flex gap-0.5 px-2 border-r border-gray-200">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          icon={Heading1}
          title="Heading 1"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          icon={Heading2}
          title="Heading 2"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          icon={Heading3}
          title="Heading 3"
        />
      </div>

      {/* Lists */}
      <div className="flex gap-0.5 px-2 border-r border-gray-200">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          icon={List}
          title="Bullet List"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          icon={ListOrdered}
          title="Numbered List"
        />
      </div>

      {/* Alignment */}
      <div className="flex gap-0.5 px-2 border-r border-gray-200">
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          isActive={editor.isActive({ textAlign: "left" })}
          icon={AlignLeft}
          title="Align Left"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          isActive={editor.isActive({ textAlign: "center" })}
          icon={AlignCenter}
          title="Align Center"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          isActive={editor.isActive({ textAlign: "right" })}
          icon={AlignRight}
          title="Align Right"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          isActive={editor.isActive({ textAlign: "justify" })}
          icon={AlignJustify}
          title="Justify"
        />
      </div>

      {/* Table Tools (Active when inside table or just table button) */}
      <div className={clsx("flex gap-0.5 px-2 border-r border-gray-200 transition-colors duration-200", isTableActive && "bg-blue-50 rounded shadow-inner")}>
        {!isTableActive ? (
          <ToolbarButton
            onClick={insertTable}
            icon={Table}
            title="Insert Table"
          />
        ) : (
          <div className="flex items-center gap-0.5 animate-in fade-in zoom-in duration-200">
            <span className="text-xs font-semibold text-blue-700 mr-1 px-1 select-none hidden md:inline">Table:</span>
            <ToolbarButton
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              icon={ColumnsIcon}
              title="Add Column Before"
              className="text-blue-700"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              icon={ColumnsIcon}
              title="Add Column After"
              className="text-blue-700"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().deleteColumn().run()}
              icon={Trash2}
              title="Delete Column"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            />
            <div className="w-px h-6 bg-blue-200 mx-1 hidden sm:block"></div>
            <ToolbarButton
              onClick={() => editor.chain().focus().addRowBefore().run()}
              icon={RowsIcon}
              title="Add Row Before"
              className="text-blue-700"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().addRowAfter().run()}
              icon={RowsIcon}
              title="Add Row After"
              className="text-blue-700"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().deleteRow().run()}
              icon={Trash2}
              title="Delete Row"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            />
            <div className="w-px h-6 bg-blue-200 mx-1 hidden sm:block"></div>
            <ToolbarButton
              onClick={() => editor.chain().focus().mergeCells().run()}
              icon={MergeIcon}
              title="Merge Cells"
              className="text-blue-700"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().splitCell().run()}
              icon={SplitIcon}
              title="Split Cell"
              className="text-blue-700"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().deleteTable().run()}
              icon={Trash2}
              title="Delete Table"
              className="text-white bg-red-600 hover:bg-red-700 hover:text-white px-2 shadow-sm"
            />
          </div>
        )}
      </div>

      {/* Insert Elements */}
      <div className="flex gap-0.5 px-2 border-r border-gray-200">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          icon={Quote}
          title="Blockquote"
        />
        <ToolbarButton
          onClick={insertHorizontalRule}
          icon={Minus}
          title="Horizontal Line"
        />
      </div>

      {/* Clear Formatting */}
      <div className="pl-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          icon={RemoveFormatting}
          title="Clear Formatting"
        />
      </div>
    </div>
  );
}
