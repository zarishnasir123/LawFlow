import {
  FileText,
  File,
  Image as ImageIcon,
  X,
  Upload,
  Trash2,
} from "lucide-react";
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileIcon(type: string) {
  if (type.includes("pdf")) return File;
  if (type.includes("image")) return ImageIcon;
  return FileText;
}

export default function DocumentSidebar({
  documents,
  onDocumentSelect,
}: DocumentSidebarProps) {
  const {
    currentDocId,
    uploadedDocuments,
    attachments,
    removeUploadedDocument,
    removeAttachment,
  } = useDocumentEditorStore();

  const allDocuments = [
    ...documents.map((d) => ({ ...d, isTemplate: true })),
    ...uploadedDocuments.map((d) => ({
      id: d.id,
      title: d.title,
      url: d.url || "",
      isTemplate: false,
    })),
  ];

  return (
    <div className="w-72 bg-white border-r border-gray-200 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-base font-semibold text-gray-900">Case File</h2>
        <p className="text-xs text-gray-500 mt-1">Recovery of Money</p>
      </div>

      {/* Prepared Documents Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Prepared Documents
          </h3>
          <div className="space-y-1">
            {allDocuments.map((doc) => (
              <button
                key={doc.id}
                onClick={() => onDocumentSelect(doc.id)}
                className={clsx(
                  "w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                  currentDocId === doc.id
                    ? "bg-blue-50 text-blue-900 shadow-sm"
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <div className="flex items-start gap-2">
                  <FileText
                    className={clsx(
                      "w-4 h-4 mt-0.5 flex-shrink-0",
                      currentDocId === doc.id ? "text-blue-600" : "text-gray-400"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.title}</p>
                    {!doc.isTemplate && (
                      <p className="text-xs text-gray-500 mt-0.5">Uploaded</p>
                    )}
                  </div>
                  {!doc.isTemplate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeUploadedDocument(doc.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-opacity"
                      title="Remove document"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    </button>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Attachments Section */}
        <div className="p-4 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Client Attachments ({attachments.length})
          </h3>
          {attachments.length === 0 ? (
            <div className="text-center py-6 px-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No attachments yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attachments.map((attachment) => {
                const Icon = getFileIcon(attachment.type);
                return (
                  <div
                    key={attachment.id}
                    className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                  >
                    <Icon className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {attachment.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(attachment.size)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeAttachment(attachment.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-opacity"
                      title="Remove attachment"
                    >
                      <X className="w-3.5 h-3.5 text-red-600" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
