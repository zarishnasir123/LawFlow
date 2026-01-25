import { Save, Download, Paperclip, FilePlus, Check } from "lucide-react";
import { useDocumentEditorStore } from "../../store/documentEditor.store";

function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

interface TopActionBarProps {
    onSaveDraft: () => void;
    onDownload: () => void;
    onAddAttachment: () => void;
    onAddDocument: () => void;
    onToggleSidebar?: () => void;
}

export default function TopActionBar({
    onSaveDraft,
    onDownload,
    onAddAttachment,
    onAddDocument,
    onToggleSidebar,
}: TopActionBarProps) {
    const { lastSaved, isDirty } = useDocumentEditorStore();

    const getStatusText = () => {
        if (isDirty) {
            return <span className="text-amber-600 font-medium">Draft</span>;
        }
        if (lastSaved) {
            const timeAgo = formatTimeAgo(lastSaved);
            return (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    Saved {timeAgo}
                </span>
            );
        }
        return <span className="text-gray-500 font-medium">Not saved</span>;
    };

    return (
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
            <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <button
                        onClick={onToggleSidebar}
                        className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-md"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="lucide lucide-menu"
                        >
                            <line x1="4" x2="20" y1="12" y2="12" />
                            <line x1="4" x2="20" y1="6" y2="6" />
                            <line x1="4" x2="20" y1="18" y2="18" />
                        </svg>
                    </button>
                    <div className="flex flex-col min-w-0">
                        <h1 className="text-lg font-semibold text-gray-900 truncate">
                            Case Document Preparation
                        </h1>
                        <div className="text-sm">{getStatusText()}</div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onSaveDraft}
                        className="flex items-center gap-2 px-3 md:px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors duration-200 font-medium text-sm"
                        title="Save Draft"
                    >
                        <Save className="w-4 h-4" />
                        <span className="hidden md:inline">Save Draft</span>
                    </button>

                    <button
                        onClick={onDownload}
                        className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium text-sm"
                        title="Download"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden md:inline">Download</span>
                    </button>

                    <button
                        onClick={onAddAttachment}
                        className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 font-medium text-sm border border-gray-200"
                        title="Add Attachment (PDF, Image, Evidence)"
                    >
                        <Paperclip className="w-4 h-4" />
                        <span className="hidden md:inline">Add Attachment (Evidence)</span>
                    </button>

                    <button
                        onClick={onAddDocument}
                        className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 font-medium text-sm border border-gray-200"
                        title="Add Editable Document (DOCX)"
                    >
                        <FilePlus className="w-4 h-4" />
                        <span className="hidden md:inline">Add Document (Editable)</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
