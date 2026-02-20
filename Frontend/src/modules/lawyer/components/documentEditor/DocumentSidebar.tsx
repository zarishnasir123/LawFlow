import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FileText,
  File,
  Image as ImageIcon,
  X,
  Upload,
  GripVertical,
} from "lucide-react";
import clsx from "clsx";
import { useState } from "react";
import {
  useDocumentEditorStore,
  type BundleItem,
} from "../../store/documentEditor.store";
import { useSignatureRequestsStore } from "../../signatures/store/signatureRequests.store";

interface DocumentSidebarProps {
  onDocumentSelect: (docId: string) => void;
  onAttachmentSelect?: (attachmentId: string | null) => void;
  caseId?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function renderBundleItemIcon({
  isDoc,
  fileType,
  isActive,
}: {
  isDoc: boolean;
  fileType?: string;
  isActive: boolean;
}) {
  const className = clsx(
    "w-4 h-4 mt-0.5 flex-shrink-0",
    isActive ? "text-blue-600" : "text-gray-400",
  );

  if (isDoc) return <FileText className={className} />;
  if (fileType?.includes("pdf")) return <File className={className} />;
  if (fileType?.includes("image")) return <ImageIcon className={className} />;
  return <FileText className={className} />;
}

// --- Sortable Item Component ---

interface SortableBundleItemProps {
  item: BundleItem;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onPreview?: () => void;
  fileInfo?: { size: number; type: string }; // Extra info for attachments
  signedLabel?: string | null;
}

function SortableBundleItem({
  item,
  isActive,
  onSelect,
  onRemove,
  onPreview,
  fileInfo,
  signedLabel,
}: SortableBundleItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isDoc = item.type === "DOC";

  const handleRowClick = () => {
    if (isDoc) {
      onSelect();
      return;
    }
    onPreview?.();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleRowClick}
      className={clsx(
        "group relative flex items-start gap-2 p-2 rounded-lg border transition-all mb-2",
        isActive
          ? "bg-blue-50 border-blue-200 shadow-sm"
          : "bg-white border-transparent hover:border-gray-200 hover:bg-gray-50",
        isDragging && "opacity-50 z-50 shadow-lg",
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="mt-1 p-0.5 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 cursor-pointer">
        <div className="flex items-start gap-2">
          {renderBundleItemIcon({
            isDoc,
            fileType: fileInfo?.type,
            isActive,
          })}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {item.title}
            </p>
            {!isDoc && fileInfo && (
              <p className="text-xs text-gray-500">
                {formatFileSize(fileInfo.size)}
              </p>
            )}
            {isDoc && (
              <p className="text-xs text-gray-400 truncate">
                Prepared Document
              </p>
            )}
            {signedLabel && (
              <span className="mt-1 inline-flex w-fit items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                {signedLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Remove Action */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 hover:bg-red-100 text-red-600 rounded"
          title="Remove from bundle"
          type="button"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// --- Main Sidebar Component ---

export default function DocumentSidebar({
  onDocumentSelect,
  onAttachmentSelect,
  caseId,
}: DocumentSidebarProps) {
  const {
    bundleItems,
    currentDocId,
    attachmentsById,
    reorderBundleItems,
    removeFromBundle,
  } = useDocumentEditorStore();
  const { getRequestsByCaseId } = useSignatureRequestsStore();
  const signatureCaseId = caseId || "default-case";
  const requests = getRequestsByCaseId(signatureCaseId);
  const requestByBundleItemId = new Map(
    requests.map((req) => [req.bundleItemId, req] as const)
  );
  const requestBySignedAttachmentId = new Map(
    requests
      .filter((req) => req.signedAttachmentId)
      .map((req) => [req.signedAttachmentId as string, req] as const)
  );
  const signedAttachmentIds = new Set(
    requests
      .filter((req) => req.clientSigned && req.signedAttachmentId)
      .map((req) => req.signedAttachmentId as string),
  );
  const [selectedBundleItemId, setSelectedBundleItemId] = useState<
    string | null
  >(null);
  const [previewAttachmentId, setPreviewAttachmentId] = useState<string | null>(
    null,
  );
  const previewAttachment = previewAttachmentId
    ? attachmentsById[previewAttachmentId]
    : null;
  const isImagePreview = previewAttachment?.type?.includes("image");
  const isPdfPreview = previewAttachment?.type?.includes("pdf");
  const isPreviewOpen = Boolean(
    previewAttachment && (isImagePreview || isPdfPreview),
  );
  const isSignedPreview = Boolean(
    previewAttachmentId && signedAttachmentIds.has(previewAttachmentId),
  );
  const derivedSelectedId =
    selectedBundleItemId ||
    (currentDocId
      ? bundleItems.find(
          (item) => item.type === "DOC" && item.refId === currentDocId,
        )?.id || null
      : null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = bundleItems.findIndex((item) => item.id === active.id);
      const newIndex = bundleItems.findIndex((item) => item.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderBundleItems(arrayMove(bundleItems, oldIndex, newIndex));
      }
    }
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-base font-semibold text-gray-900">
          Bundle Sequencing
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Drag to reorder - {bundleItems.length} items
        </p>
      </div>

      {/* Bundle List */}
      <div className="flex-1 overflow-y-auto p-3">
        {bundleItems.length === 0 ? (
          <div className="text-center py-6 px-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 mt-4">
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No documents or attachments</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={bundleItems.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {bundleItems.map((item) => {
                  // Get extra info if attachment
                  const att =
                    item.type === "ATTACHMENT"
                      ? attachmentsById[item.refId]
                      : undefined;
                  const fileInfo = att
                    ? { size: att.size, type: att.type }
                    : undefined;
                  const isPreviewableAttachment =
                    item.type === "ATTACHMENT" &&
                    (fileInfo?.type?.includes("image") ||
                      fileInfo?.type?.includes("pdf"));
                  const request =
                    requestByBundleItemId.get(item.id) ||
                    (item.type === "ATTACHMENT"
                      ? requestBySignedAttachmentId.get(item.refId)
                      : undefined);
                  const signedLabel =
                    request && request.clientSigned && request.lawyerSigned
                      ? "Client + Lawyer Signed"
                      : request?.clientSigned
                        ? "Client Signed"
                        : request?.lawyerSigned
                          ? "Lawyer Signed"
                          : item.type === "ATTACHMENT" &&
                              (signedAttachmentIds.has(item.refId) ||
                                att?.name?.toLowerCase().includes("signed"))
                            ? "Client Signed"
                            : null;

                  return (
                    <SortableBundleItem
                      key={item.id}
                      item={item}
                      isActive={item.id === derivedSelectedId}
                      fileInfo={fileInfo}
                      signedLabel={signedLabel}
                      onSelect={() => {
                        if (item.type === "DOC") {
                          if (selectedBundleItemId === item.id) {
                            setSelectedBundleItemId(null);
                            onAttachmentSelect?.(null);
                            return;
                          }
                          setSelectedBundleItemId(item.id);
                          onAttachmentSelect?.(null);
                          onDocumentSelect(item.refId);
                        }
                      }}
                      onPreview={
                        item.type === "ATTACHMENT"
                          ? () => {
                              if (selectedBundleItemId === item.id) {
                                setSelectedBundleItemId(null);
                                setPreviewAttachmentId(null);
                                onAttachmentSelect?.(null);
                                return;
                              }
                              setSelectedBundleItemId(item.id);
                              if (fileInfo?.type?.includes("pdf")) {
                                setPreviewAttachmentId(null);
                                onAttachmentSelect?.(item.refId);
                                return;
                              }
                              onAttachmentSelect?.(null);
                              if (isPreviewableAttachment) {
                                setPreviewAttachmentId(item.refId);
                              }
                            }
                          : undefined
                      }
                      onRemove={() => removeFromBundle(item.id)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {previewAttachment && isPreviewOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6"
          onClick={() => setPreviewAttachmentId(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl rounded-lg bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {previewAttachment.name}
                </p>
                <p className="text-xs text-gray-500">
                  {previewAttachment.type}
                </p>
              </div>
              <button
                onClick={() => setPreviewAttachmentId(null)}
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3">
              {isImagePreview ? (
                <img
                  src={previewAttachment.url}
                  alt={previewAttachment.name}
                  className="mx-auto max-h-[70vh] w-auto object-contain"
                />
              ) : (
                <iframe
                  title={previewAttachment.name}
                  src={previewAttachment.url}
                  className="h-[70vh] w-full rounded border-0 bg-white"
                />
              )}
            </div>
            {isSignedPreview && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="rounded-md border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  type="button"
                >
                  Convert to DOCX (mock)
                </button>
                <span className="text-xs text-gray-500">
                  Backend conversion will replace this mock action.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
