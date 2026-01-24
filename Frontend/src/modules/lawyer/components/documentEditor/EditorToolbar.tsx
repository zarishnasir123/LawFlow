import { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table,
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
}

function ToolbarButton({
  onClick,
  isActive,
  icon: Icon,
  title,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx(
        "p-2 rounded transition-colors duration-200",
        isActive
          ? "bg-green-100 text-green-700"
          : "text-gray-600 hover:bg-gray-100"
      )}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}

export default function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  const insertTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  return (
    <div className="bg-white border-b border-gray-200 p-4 flex flex-wrap gap-2">
      {/* Text Formatting */}
      <div className="flex gap-1 border-r border-gray-300 pr-3">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          icon={Bold}
          title="Bold"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          icon={Italic}
          title="Italic"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          icon={Underline}
          title="Underline"
        />
      </div>

      {/* Headings */}
      <div className="flex gap-1 border-r border-gray-300 pr-3">
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
      </div>

      {/* Lists */}
      <div className="flex gap-1 border-r border-gray-300 pr-3">
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
      <div className="flex gap-1 border-r border-gray-300 pr-3">
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
      </div>

      {/* Table */}
      <div>
        <ToolbarButton
          onClick={insertTable}
          icon={Table}
          title="Insert Table"
        />
      </div>
    </div>
  );
}
