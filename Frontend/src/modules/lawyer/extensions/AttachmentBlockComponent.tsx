import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/core';
import { useEffect, useState } from 'react';
import { File, FileText, Image as ImageIcon, X, Download, AlertTriangle } from 'lucide-react';
import { useDocumentEditorStore } from '../store/documentEditor.store';

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function FileIcon({ mimeType, className }: { mimeType: string; className: string }) {
    if (mimeType.includes('pdf')) return <File className={className} />;
    if (mimeType.includes('image')) return <ImageIcon className={className} />;
    return <FileText className={className} />;
}

function getImageAttachmentNumber(editor: NodeViewProps['editor'], getPos: NodeViewProps['getPos']) {
    if (!editor || typeof getPos !== 'function') return null;
    const targetPos = getPos();
    let count = 0;
    let index: number | null = null;

    editor.state.doc.descendants((docNode, pos) => {
        const isImageAttachment =
            docNode.type.name === 'imageAttachment' ||
            (docNode.type.name === 'attachmentBlock' &&
                typeof docNode.attrs?.mimeType === 'string' &&
                docNode.attrs.mimeType.includes('image'));

        if (isImageAttachment) {
            count += 1;
            if (pos === targetPos) {
                index = count;
            }
        }
        return true;
    });

    return index;
}

export function AttachmentBlockComponent({ node, deleteNode, editor, getPos }: NodeViewProps) {
    const { attachmentsById } = useDocumentEditorStore();
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [imageNumber, setImageNumber] = useState<number | null>(null);

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
    const isImage = mimeType?.includes('image');

    useEffect(() => {
        if (!isImage) return;
        const updateIndex = () => {
            setImageNumber(getImageAttachmentNumber(editor, getPos));
        };
        updateIndex();
        editor?.on('transaction', updateIndex);
        return () => {
            editor?.off('transaction', updateIndex);
        };
    }, [editor, getPos, isImage]);

    const handleOpen = () => {
        if (!isMissing && url && isImage) {
            setIsPreviewOpen(true);
            return;
        }
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
                            <FileIcon mimeType={mimeType} className="w-6 h-6 text-blue-600" />
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
                                            <span>-</span>
                                        </>
                                    )}
                                    {isImage && imageNumber && (
                                        <>
                                            <span>Image Attachment #{imageNumber}</span>
                                            <span>-</span>
                                        </>
                                    )}
                                    {uploadedAt && (
                                        <span>{new Date(uploadedAt).toLocaleDateString()}</span>
                                    )}
                                </div>
                                {isMissing && (
                                    <p className="text-xs text-red-700 mt-1">
                                        Warning: This attachment has been deleted from the bundle.
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
                                            title={isImage ? 'Preview image' : 'Open attachment'}
                                            type="button"
                                        >
                                            {isImage ? (
                                                <ImageIcon className="w-4 h-4 text-blue-700" />
                                            ) : (
                                                <Download className="w-4 h-4 text-blue-700" />
                                            )}
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
                        {!isMissing && isImage && url && (
                            <button
                                type="button"
                                onClick={() => setIsPreviewOpen(true)}
                                className="mt-3 block w-full overflow-hidden rounded-md border border-blue-200 bg-white shadow-sm"
                                title="Preview image"
                            >
                                <img
                                    src={url}
                                    alt={name}
                                    className="max-h-[260px] w-full object-contain"
                                />
                            </button>
                        )}
                    </div>
                </div>
            </div>
            {isPreviewOpen && !isMissing && url && isImage && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6"
                    onClick={() => setIsPreviewOpen(false)}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-4xl rounded-lg bg-white p-4 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-gray-900">
                                    {isImage && imageNumber ? `Image Attachment #${imageNumber} - ${name}` : name}
                                </p>
                                <p className="text-xs text-gray-500">{mimeType}</p>
                            </div>
                            <button
                                onClick={() => setIsPreviewOpen(false)}
                                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                                type="button"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="max-h-[75vh] overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3">
                            <img
                                src={url}
                                alt={name}
                                className="mx-auto max-h-[70vh] w-auto object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}
        </NodeViewWrapper>
    );
}
