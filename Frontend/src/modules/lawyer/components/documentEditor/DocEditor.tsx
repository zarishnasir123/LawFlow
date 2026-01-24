import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect } from "react";
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
      let html = editor.getHTML();
      // Automatically highlight {{PLACEHOLDER}} patterns
      html = html.replace(/\{\{([^}]+)\}\}/g, '<span style="background-color: #fef3c7; padding: 2px 4px; border-radius: 3px; font-weight: 500; color: #92400e;">{{$1}}</span>');
      onContentChange(html);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[600px]',
      },
    },
  });

  // Update editor content when content prop changes
  useEffect(() => {
    if (editor && content && !isLoading) {
      const currentContent = editor.getHTML();
      // Only update if content has actually changed to avoid unnecessary re-renders
      if (currentContent !== content) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
    }
  }, [content, editor, isLoading]);

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      <EditorToolbar editor={editor} />

      <div className="flex-1 overflow-auto p-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading document...</p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-md p-12 min-h-[11in] border border-gray-200"
              style={{
                fontFamily: "'Times New Roman', serif",
                fontSize: '12pt',
                lineHeight: '1.6',
              }}
            >
              <EditorContent editor={editor} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
