import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import EditorToolbar from "./EditorToolbar";

interface DocEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  isLoading: boolean;
}

export default function DocEditor({
  content,
  onContentChange,
  isLoading,
}: DocEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content || "<p>Loading document...</p>",
    onUpdate: ({ editor }) => {
      onContentChange(editor.getHTML());
    },
  });

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      <EditorToolbar editor={editor} />

      <div className="flex-1 overflow-auto p-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Converting document...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-8 prose prose-sm max-w-none min-h-full">
            <EditorContent editor={editor} />
          </div>
        )}
      </div>
    </div>
  );
}
