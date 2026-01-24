import clsx from "clsx";
import { useDocumentEditorStore } from "../../store/documentEditor.store";

interface Document {
  id: string;
  title: string;
  url: string;
}

interface DocumentSidebarProps {
  documents: Document[];
  onDocumentSelect: (docId: string) => void;
}

export default function DocumentSidebar({
  documents,
  onDocumentSelect,
}: DocumentSidebarProps) {
  const currentDocId = useDocumentEditorStore((state) => state.currentDocId);

  return (
    <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-900">Documents</h2>
        <p className="text-sm text-gray-500 mt-1">Recovery of Money Case</p>
      </div>

      <div className="divide-y divide-gray-100">
        {documents.map((doc) => (
          <button
            key={doc.id}
            onClick={() => onDocumentSelect(doc.id)}
            className={clsx(
              "w-full text-left px-6 py-4 transition-colors duration-200",
              currentDocId === doc.id
                ? "bg-green-50 border-l-4 border-green-600 text-green-900"
                : "text-gray-700 hover:bg-gray-50 border-l-4 border-transparent"
            )}
          >
            <p className="font-semibold text-sm">{doc.title}</p>
            <p className="text-xs text-gray-500 mt-1">{doc.id}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
