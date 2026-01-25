import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/core';
import { File, FileText, Image as ImageIcon, X, Download, AlertTriangle } from 'lucide-react';
import { useDocumentEditorStore } from '../store/documentEditor.store';

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(mimeType: string) {
    if (mimeType.includes('pdf')) return File;
    if (mimeType.includes('image')) return ImageIcon;
    return FileText;
}

export function AttachmentBlockComponent({ node, deleteNode }: NodeViewProps) {
    const { attachmentsById } = useDocumentEditorStore();

    const {
        attachmentId,
        name,
        url,
        mimeType,
        size,
        uploadedAt,
    } = node.attrs;

    // Check if attachment still exists in the store (Rule A: attachment stays in bundle)
    const attachmentExists = attachmentsById[attachmentId];
    const isMissing = !attachmentExists;

    const Icon = getFileIcon(mimeType);

    const handleOpen = () => {
        if (!isMissing && url) {
            window.open(url, '_blank');
        }
    };

    const handleDownload = () => {
        if (!isMissing && url) {
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    const handleDelete = () => {
        deleteNode();
    };

    return (
        <NodeViewWrapper className="attachment-block-node">
            <div
                className={`
          my-3 p-4 border-2 rounded-lg transition-all
          ${isMissing
                        ? 'border-red-300 bg-red-50'
                        : 'border-blue-200 bg-blue-50 hover:border-blue-400 hover:shadow-md'
                    }
        `}
                contentEditable={false}
            >
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`
            p-2 rounded-lg flex-shrink-0
            ${isMissing ? 'bg-red-100' : 'bg-blue-100'}
          `}>
                        {isMissing ? (
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        ) : (
                            <Icon className="w-6 h-6 text-blue-600" />
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <h4 className={`
                  font-semibold text-sm truncate
                  ${isMissing ? 'text-red-900' : 'text-gray-900'}
                `}>
                                    {name}
                                    {isMissing && ' (Missing)'}
                                </h4>
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                                    {!isMissing && size && (
                                        <>
                                            <span>{formatFileSize(size)}</span>
                                            <span>•</span>
                                        </>
                                    )}
                                    {uploadedAt && (
                                        <span>{new Date(uploadedAt).toLocaleDateString()}</span>
                                    )}
                                </div>
                                {isMissing && (
                                    <p className="text-xs text-red-700 mt-1">
                                        ⚠️ This attachment has been deleted from the bundle.
                                    </p>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                                {!isMissing && (
                                    <>
                                        <button
                                            onClick={handleOpen}
                                            className="p-1.5 hover:bg-blue-200 rounded transition-colors"
                                            title="Open attachment"
                                            type="button"
                                        >
                                            <Download className="w-4 h-4 text-blue-700" />
                                        </button>
                                        <button
                                            onClick={handleDownload}
                                            className="p-1.5 hover:bg-blue-200 rounded transition-colors"
                                            title="Download attachment"
                                            type="button"
                                        >
                                            <File className="w-4 h-4 text-blue-700" />
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={handleDelete}
                                    className={`
                    p-1.5 rounded transition-colors
                    ${isMissing
                                            ? 'hover:bg-red-200'
                                            : 'hover:bg-blue-200'
                                        }
                  `}
                                    title="Remove from document"
                                    type="button"
                                >
                                    <X className={`w-4 h-4 ${isMissing ? 'text-red-700' : 'text-blue-700'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </NodeViewWrapper>
    );
}
