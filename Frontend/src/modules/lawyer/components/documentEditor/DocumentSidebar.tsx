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
  PlusCircle,
} from "lucide-react";
import clsx from "clsx";
import { useDocumentEditorStore, type BundleItem } from "../../store/documentEditor.store";

interface DocumentSidebarProps {
  onDocumentSelect: (docId: string) => void;
  onInsertAttachment?: (attachmentId: string) => void;
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

// --- Sortable Item Component ---

interface SortableBundleItemProps {
  item: BundleItem;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onInsert?: () => void;
  fileInfo?: { size: number; type: string }; // Extra info for attachments
}

function SortableBundleItem({
  item,
  isActive,
  onSelect,
  onRemove,
  onInsert,
  fileInfo,
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
  // Determine icon
  let Icon = FileText;
  if (!isDoc && fileInfo) {
    Icon = getFileIcon(fileInfo.type);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative flex items-start gap-2 p-2 rounded-lg border transition-all mb-2",
        isActive
          ? "bg-blue-50 border-blue-200 shadow-sm"
          : "bg-white border-transparent hover:border-gray-200 hover:bg-gray-50",
        isDragging && "opacity-50 z-50 shadow-lg"
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
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={isDoc ? onSelect : undefined}
      >
        <div className="flex items-start gap-2">
          <Icon
            className={clsx(
              "w-4 h-4 mt-0.5 flex-shrink-0",
              isActive ? "text-blue-600" : "text-gray-400"
            )}
          />
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
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Helper Action: Insert Attachment (Only for Attachments) */}
        {!isDoc && onInsert && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onInsert();
            }}
            className="p-1 hover:bg-blue-100 text-blue-600 rounded"
            title="Insert at cursor"
          >
            <PlusCircle className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Remove Action (Only for uploaded docs/attachments - standard docs might be protected logic, but here we allow removal via bundle logic) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 hover:bg-red-100 text-red-600 rounded"
          title="Remove from bundle"
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
  onInsertAttachment,
}: DocumentSidebarProps) {
  const {
    bundleItems,
    currentDocId,
    attachmentsById,
    reorderBundleItems,
    removeFromBundle,
  } = useDocumentEditorStore();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
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
        <h2 className="text-base font-semibold text-gray-900">Bundle Sequencing</h2>
        <p className="text-xs text-gray-500 mt-1">Drag to reorder • {bundleItems.length} items</p>
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
                  const att = item.type === "ATTACHMENT" ? attachmentsById[item.refId] : undefined;
                  const fileInfo = att ? { size: att.size, type: att.type } : undefined;

                  return (
                    <SortableBundleItem
                      key={item.id}
                      item={item}
                      isActive={item.type === "DOC" && item.refId === currentDocId}
                      fileInfo={fileInfo}
                      onSelect={() => {
                        if (item.type === "DOC") {
                          onDocumentSelect(item.refId);
                        }
                      }}
                      onRemove={() => removeFromBundle(item.id)}
                      onInsert={
                        item.type === "ATTACHMENT" && onInsertAttachment
                          ? () => onInsertAttachment(item.refId)
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
