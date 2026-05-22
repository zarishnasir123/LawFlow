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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useState } from "react";

// LocalStorage key mirrors the admin sidebar's pattern so each user gets
// per-device persistence of their preferred sidebar state.
const SIDEBAR_COLLAPSED_KEY = "lawflow_lawyer_editor_sidebar_collapsed";

function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}
import {
  useDocumentEditorStore,
  type BundleItem,
} from "../../store/documentEditor.store";
import { useSignatureRequestsStore } from "../../signatures/store/signatureRequests.store";
import DocumentPagesPanel from "./DocumentPagesPanel";

interface DocumentSidebarProps {
  onDocumentSelect: (docId: string) => void;
  onAttachmentSelect?: (attachmentId: string | null) => void;
  caseId?: string;
  // Pages rendered by docx-preview. The sidebar's Pages panel uses these
  // DOM refs for jump-to-page and per-page actions like "send to client".
  pages?: HTMLElement[];
  onSendPageToClient?: (pageIndex: number, pageElement: HTMLElement) => void;
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
  // When false the drag handle is hidden — there's no point showing a
  // reorder grip when the list has only one item.
  showDragHandle: boolean;
  // The case-template doc is the only one that can't be removed (it's
  // the entire reason the editor exists). Attachments can be.
  isRemovable: boolean;
}

function SortableBundleItem({
  item,
  isActive,
  onSelect,
  onRemove,
  onPreview,
  fileInfo,
  signedLabel,
  showDragHandle,
  isRemovable,
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
  const isAttachment = item.type === "ATTACHMENT";
  // Only PNG/JPG image attachments are draggable — they drop onto a
  // template page as a floating overlay (evidence photos, CNIC scans).
  // PDFs, DOCX uploads, the case template itself: not draggable.
  const isImageAttachment = isAttachment && Boolean(fileInfo?.type?.startsWith("image/"));

  const handleRowClick = () => {
    if (isDoc) {
      onSelect();
      return;
    }
    onPreview?.();
  };

  const handleNativeDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isImageAttachment) return;
    e.dataTransfer.setData(
      "application/x-lawflow-image",
      JSON.stringify({ refId: item.refId })
    );
    e.dataTransfer.effectAllowed = "copy";
    e.stopPropagation();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleRowClick}
      draggable={isImageAttachment}
      onDragStart={isImageAttachment ? handleNativeDragStart : undefined}
      title={
        isImageAttachment
          ? "Drag onto a page to place as an inline image"
          : undefined
      }
      className={clsx(
        "group relative flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-colors",
        isActive
          ? "bg-[var(--primary)]/8 ring-1 ring-[var(--primary)]/20"
          : "hover:bg-gray-50",
        isDragging && "opacity-50 z-50 shadow-lg",
        isImageAttachment && "cursor-grab active:cursor-grabbing"
      )}
    >
      {/* Drag Handle — only when reordering matters (2+ items) */}
      {showDragHandle && (
        <div
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}

      {/* File icon — replaces the heavy ordinal badge; ordinals are
          only meaningful when there's more than one document. */}
      <div className={clsx(
        "flex-shrink-0",
        isActive ? "text-[var(--primary)]" : "text-gray-400"
      )}>
        {renderBundleItemIcon({
          isDoc,
          fileType: fileInfo?.type,
          isActive,
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={clsx(
          "text-sm truncate",
          isActive ? "text-[var(--primary)] font-semibold" : "text-gray-800 font-medium"
        )}>
          {item.title}
        </p>
        {!isDoc && fileInfo && (
          <p className="text-[11px] text-gray-500 mt-0.5">
            {formatFileSize(fileInfo.size)}
          </p>
        )}
        {signedLabel && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
            <span className="w-1 h-1 rounded-full bg-emerald-500" />
            {signedLabel}
          </span>
        )}
      </div>

      {/* Actions — case-template doc isn't removable; only attachments
          and uploaded docs are. */}
      <div className={clsx(
        "flex-shrink-0 opacity-0 transition-opacity",
        isRemovable && "group-hover:opacity-100"
      )}>
        {isRemovable && (<button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded"
          title="Remove from bundle"
          type="button"
        >
          <X className="w-3.5 h-3.5" />
        </button>)}
      </div>
    </div>
  );
}

// --- Main Sidebar Component ---

export default function DocumentSidebar({
  onDocumentSelect,
  onAttachmentSelect,
  caseId,
  pages = [],
  onSendPageToClient,
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
  const [collapsed, setCollapsed] = useState<boolean>(readStoredCollapsed);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      // Ignore — localStorage might be blocked in private mode.
    }
  }, [collapsed]);
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
    <div
      className={clsx(
        "relative bg-white border-r border-gray-200 flex flex-col h-full transition-[width] duration-200 ease-out",
        collapsed ? "w-[56px]" : "w-80"
      )}
    >
      {/* Edge-mounted collapse/expand pill, mirrors the admin sidebar
          pattern. Sits half-overlapping the right edge so it reads as a
          natural hinge between the sidebar and the document area. */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="absolute top-3 -right-3 z-20 h-6 w-6 flex items-center justify-center rounded-full bg-white text-gray-700 shadow-md ring-1 ring-gray-200 hover:bg-gray-50 hover:text-gray-900"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* One scrollable column. The Bundle Sequencing list shrinks to fit its
          items (capped) so the Document Sections panel below it stays
          visible without the lawyer having to scroll past the bundle. */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
      {/* Header — hidden when collapsed; the icons in the items below
          stand in as visual anchors. */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.08em]">
              Documents
            </h2>
            {bundleItems.length > 1 && (
              <span className="text-[10px] text-gray-400 font-medium">
                {bundleItems.length} items
              </span>
            )}
          </div>
        </div>
      )}

      {/* Bundle List — hidden when collapsed; the rendered pages already
          imply the case doc, so showing a tall doc card in a narrow
          sidebar would just feel cramped. */}
      {!collapsed && (
      <div className="px-2 py-2">
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
                      showDragHandle={bundleItems.length > 1}
                      isRemovable={item.type === "ATTACHMENT"}
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
      )}

      {/* Document Pages — real page boundaries from docx-preview's
          paginated render, matching Word's Navigation Pane "Pages" tab. */}
      <DocumentPagesPanel
        pages={pages}
        onSendPageToClient={onSendPageToClient}
        collapsed={collapsed}
      />
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
