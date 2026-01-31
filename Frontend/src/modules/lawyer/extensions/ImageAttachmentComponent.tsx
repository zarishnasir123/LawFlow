import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/core";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Image as ImageIcon, X } from "lucide-react";
import { useDocumentEditorStore } from "../store/documentEditor.store";

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAttachmentNumber(editor: NodeViewProps["editor"], getPos: NodeViewProps["getPos"]) {
  if (!editor || typeof getPos !== "function") return null;
  const targetPos = getPos();
  let count = 0;
  let index: number | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "imageAttachment") {
      count += 1;
      if (pos === targetPos) {
        index = count;
      }
    }
    return true;
  });

  return index;
}

export function ImageAttachmentComponent({
  node,
  deleteNode,
  editor,
  getPos,
}: NodeViewProps) {
  const { attachmentsById } = useDocumentEditorStore();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [attachmentNumber, setAttachmentNumber] = useState<number | null>(null);

  const {
    attachmentId,
    name,
    url,
    size,
    uploadedAt,
  } = node.attrs;

  const attachment = attachmentsById[attachmentId];
  const isMissing = !attachment;
  const displayName = attachment?.name || name;
  const displayUrl = attachment?.url || url;
  const displaySize = attachment?.size || size;
  const displayUploadedAt = attachment?.uploadedAt || uploadedAt;

  useEffect(() => {
    const updateIndex = () => {
      setAttachmentNumber(getAttachmentNumber(editor, getPos));
    };
    updateIndex();
    editor?.on("transaction", updateIndex);
    return () => {
      editor?.off("transaction", updateIndex);
    };
  }, [editor, getPos]);

  const caption = useMemo(() => {
    const numberLabel = attachmentNumber ? `Image Attachment #${attachmentNumber}` : "Image Attachment";
    return `${numberLabel} - ${displayName}`;
  }, [attachmentNumber, displayName]);

  return (
    <NodeViewWrapper className="image-attachment-node">
      <figure
        className={`my-4 rounded-lg border p-3 transition-all ${
          isMissing
            ? "border-red-300 bg-red-50"
            : "border-emerald-200 bg-emerald-50 hover:border-emerald-300"
        }`}
        contentEditable={false}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            {isMissing ? (
              <>
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span>Missing image attachment</span>
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4 text-emerald-700" />
                <span>{formatFileSize(displaySize)}</span>
                {displayUploadedAt && (
                  <span className="text-gray-400">
                    {new Date(displayUploadedAt).toLocaleDateString()}
                  </span>
                )}
              </>
            )}
          </div>

          <button
            onClick={deleteNode}
            className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
            title="Remove image from document"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!isMissing ? (
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="mt-3 block w-full overflow-hidden rounded-md border border-emerald-200 bg-white shadow-sm"
            title="Preview image"
          >
            <img
              src={displayUrl}
              alt={displayName}
              className="max-h-[420px] w-full object-contain"
            />
          </button>
        ) : (
          <div className="mt-3 flex items-center justify-center rounded-md border border-red-200 bg-white p-6 text-sm text-red-700">
            Image not available.
          </div>
        )}

        <figcaption className="mt-2 text-xs font-medium text-emerald-900">
          {caption}
        </figcaption>
      </figure>

      {isPreviewOpen && (
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
                <p className="text-sm font-semibold text-gray-900">{caption}</p>
                <p className="text-xs text-gray-500">{displayName}</p>
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
                src={displayUrl}
                alt={displayName}
                className="mx-auto max-h-[70vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
}
