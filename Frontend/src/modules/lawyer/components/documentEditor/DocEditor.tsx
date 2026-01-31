import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import { useEffect, useRef } from "react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import BubbleMenuExtension from "@tiptap/extension-bubble-menu";
import { AttachmentBlock } from "../../extensions/AttachmentBlock";
import { ImageAttachment } from "../../extensions/ImageAttachment";
import { useDocumentEditorStore } from "../../store/documentEditor.store";
import EditorToolbar from "./EditorToolbar";

interface DocEditorProps {
  content: string | JSONContent;
  onContentChange: (content: JSONContent) => void;
  isLoading: boolean;
}

export default function DocEditor({
  content,
  onContentChange,
  isLoading,
}: DocEditorProps) {
  const isInitialMount = useRef(true);
  const isUpdating = useRef(false);
  const { setEditorRef } = useDocumentEditorStore();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        horizontalRule: {
          HTMLAttributes: {
            class: 'my-4 border-t-2 border-gray-300',
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: 'border-l-4 border-gray-300 pl-4 italic',
          },
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 px-4 py-2 bg-gray-100 font-bold',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 px-4 py-2',
        },
      }),
      BubbleMenuExtension.configure({
        pluginKey: 'bubbleMenuTable',
        shouldShow: ({ editor }) => {
          return editor.isActive('table');
        },
      }),
      AttachmentBlock,
      ImageAttachment,
    ],
    content: "",
    onUpdate: ({ editor }) => {
      if (!isUpdating.current) {
        // Emit JSON instead of HTML
        const json = editor.getJSON();
        onContentChange(json);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[600px]',
        spellcheck: 'true',
      },
    },
    enableInputRules: true,
    enablePasteRules: true,
    editable: true,
  });

  // Only update editor content when loading a new document, not during typing
  useEffect(() => {
    if (editor && content && !isLoading) {
      // On initial mount or when switching documents
      if (isInitialMount.current || !editor.isFocused) {
        const currentContent = editor.getHTML();

        // Only update if content is actually different
        if (currentContent !== content) {
          isUpdating.current = true;

          // Use transaction to preserve cursor position
          const { from, to } = editor.state.selection;
          editor.commands.setContent(content, { emitUpdate: false });

          // Restore cursor position if editor was focused
          if (editor.isFocused && from !== undefined) {
            try {
              editor.commands.setTextSelection({ from, to });
            } catch {
              // If position is invalid, just focus at end
              editor.commands.focus('end');
            }
          }

          setTimeout(() => {
            isUpdating.current = false;
          }, 100);
        }

        isInitialMount.current = false;
      }
    }
  }, [content, editor, isLoading]);

  // Register editor instance in store for attachment insertion
  useEffect(() => {
    if (editor) {
      setEditorRef(editor);
    }
    return () => {
      setEditorRef(null);
    };
  }, [editor, setEditorRef]);


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
              <style>{`
                .ProseMirror {
                  cursor: text;
                  caret-color: #000;
                  outline: none;
                }
                .ProseMirror hr {
                  border: none;
                  border-top: 2px solid #d1d5db;
                  margin: 2rem 0;
                  cursor: pointer;
                }
                .ProseMirror hr:hover {
                  border-top-color: #9ca3af;
                }
                .ProseMirror hr.ProseMirror-selectednode {
                  border-top-color: #3b82f6;
                  border-top-width: 3px;
                }
                .ProseMirror blockquote {
                  border-left: 4px solid #d1d5db;
                  padding-left: 1rem;
                  font-style: italic;
                  color: #4b5563;
                  margin: 1rem 0;
                }
                .ProseMirror table {
                  border-collapse: collapse;
                  width: 100%;
                  margin: 1rem 0;
                }
                .ProseMirror th,
                .ProseMirror td {
                  border: 1px solid #d1d5db;
                  padding: 0.5rem 1rem;
                  text-align: left;
                  position: relative;
                }
                .ProseMirror .selectedCell:after {
                  z-index: 2;
                  position: absolute;
                  content: "";
                  left: 0; right: 0; top: 0; bottom: 0;
                  background: rgba(200, 200, 255, 0.4);
                  pointer-events: none;
                }
                .ProseMirror th {
                  background-color: #f3f4f6;
                  font-weight: bold;
                }
                .ProseMirror code {
                  background-color: #f3f4f6;
                  padding: 0.125rem 0.25rem;
                  border-radius: 0.25rem;
                  font-family: monospace;
                  font-size: 0.9em;
                }
                .ProseMirror:focus {
                  outline: none;
                }
                .ProseMirror ul,
                .ProseMirror ol {
                  padding-left: 2rem;
                  margin: 0.5rem 0;
                }
                .ProseMirror li {
                  margin: 0.25rem 0;
                }
                .ProseMirror h1 {
                  font-size: 2em;
                  font-weight: bold;
                  margin: 1rem 0 0.5rem 0;
                }
                .ProseMirror h2 {
                  font-size: 1.5em;
                  font-weight: bold;
                  margin: 0.75rem 0 0.5rem 0;
                }
                .ProseMirror h3 {
                  font-size: 1.25em;
                  font-weight: bold;
                  margin: 0.5rem 0 0.25rem 0;
                }
                .ProseMirror p {
                  margin: 0.5rem 0;
                }
                .ProseMirror strong {
                  font-weight: bold;
                }
                .ProseMirror em {
                  font-style: italic;
                }
                .ProseMirror u {
                  text-decoration: underline;
                }
                .ProseMirror s {
                  text-decoration: line-through;
                }
              `}</style>
              <EditorContent editor={editor} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
