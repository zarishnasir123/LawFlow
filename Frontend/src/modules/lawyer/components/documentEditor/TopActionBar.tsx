import { FileSignature, UploadCloud, Cloud, CloudOff } from "lucide-react";
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
    onSubmitCase?: () => void;
    onRequestSignatures?: () => void;
    signaturePendingCount?: number;
    onToggleSidebar?: () => void;
    // Title bar shows the case document's display name (e.g.,
    // "Khula (Wife's Judicial Divorce)") not a generic "Case Document
    // Preparation" — matches Google Docs' file-title pattern.
    docTitle?: string;
    docSubtitle?: string | null;
}

export default function TopActionBar({
    onSubmitCase,
    onRequestSignatures,
    signaturePendingCount,
    onToggleSidebar,
    docTitle,
    docSubtitle,
}: TopActionBarProps) {
    const { lastSaved, isDirty } = useDocumentEditorStore();

    // Google Docs-style "Last edited X ago" line. Shows a cloud icon to
    // signal sync state: solid cloud = saved, struck-through cloud =
    // unsaved (the "you have unsaved changes" cue Docs uses).
    const renderSaveStatus = () => {
        if (isDirty) {
            return (
                <span className="text-amber-700 inline-flex items-center gap-1.5">
                    <CloudOff className="w-3.5 h-3.5" />
                    Unsaved changes
                </span>
            );
        }
        if (lastSaved) {
            return (
                <span className="text-gray-500 inline-flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5" />
                    Last edited {formatTimeAgo(lastSaved)}
                </span>
            );
        }
        return (
            <span className="text-gray-500 inline-flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5" />
                Draft
            </span>
        );
    };

    return (
        // Google Docs-style title bar: the file's name is the hero. Save
        // status sits beneath it as quiet caption text. Right side carries
        // just two actions — Signatures (like Docs' Comments icon) and
        // Submit Case (the equivalent of Docs' "Share" primary button).
        // Save Draft / Download / Add Attachment / Add Document have moved
        // into the formatting toolbar so the title bar stays uncluttered.
        <div className="flex-shrink-0 bg-white border-b border-gray-200">
            <div className="px-5 py-2 flex items-center justify-between gap-4">
                {/* Left: doc title + last-edited caption */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                        onClick={onToggleSidebar}
                        className="md:hidden p-1.5 -ml-1 text-gray-600 hover:bg-gray-100 rounded-md"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="4" x2="20" y1="12" y2="12" />
                            <line x1="4" x2="20" y1="6" y2="6" />
                            <line x1="4" x2="20" y1="18" y2="18" />
                        </svg>
                    </button>
                    <div className="flex flex-col min-w-0">
                        <h1 className="text-[15px] font-semibold text-gray-900 truncate leading-tight">
                            {docTitle || "Untitled document"}
                        </h1>
                        <div className="flex items-center gap-2 text-[11.5px] mt-0.5 text-gray-500">
                            {docSubtitle && (
                                <>
                                    <span className="truncate max-w-[280px]">{docSubtitle}</span>
                                    <span className="text-gray-300">·</span>
                                </>
                            )}
                            {renderSaveStatus()}
                        </div>
                    </div>
                </div>

                {/* Right: just two actions — Signatures (icon-only badge, like
                    Docs' Comments button) and Submit Case (primary action,
                    like Docs' Share). Utility actions are in the toolbar. */}
                <div className="flex items-center gap-2">
                    {onRequestSignatures && (
                        <button
                            onClick={onRequestSignatures}
                            className="relative inline-flex items-center gap-1.5 h-9 px-3 text-gray-700 rounded-full hover:bg-gray-100 transition-colors text-[13px] font-medium"
                            title="Request signatures from client and/or lawyer"
                        >
                            <FileSignature className="w-4 h-4" />
                            <span className="hidden lg:inline">Signatures</span>
                            {signaturePendingCount !== undefined && signaturePendingCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                    {signaturePendingCount}
                                </span>
                            )}
                        </button>
                    )}

                    {onSubmitCase && (
                        <button
                            onClick={onSubmitCase}
                            className="inline-flex items-center gap-1.5 h-9 px-4 bg-[var(--primary)] text-white rounded-full hover:bg-[#024a23] transition-colors text-[13px] font-semibold"
                            title="Submit case to registrar"
                        >
                            <UploadCloud className="w-4 h-4" />
                            <span>Submit</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
