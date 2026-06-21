import {
  AlertCircle,
  Calendar,
  CreditCard,
  FileText,
  MessageSquare,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Notification } from "../types/notification";

interface NotificationCardProps {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick: (notification: Notification) => void;
}

const TYPE_STYLE: Record<
  Notification["type"],
  { icon: LucideIcon; chip: string }
> = {
  case: { icon: AlertCircle, chip: "bg-blue-100 text-blue-600" },
  hearing: { icon: Calendar, chip: "bg-purple-100 text-purple-600" },
  message: { icon: MessageSquare, chip: "bg-green-100 text-green-600" },
  document: { icon: FileText, chip: "bg-amber-100 text-amber-600" },
  payment: { icon: CreditCard, chip: "bg-emerald-100 text-emerald-600" },
  system: { icon: AlertCircle, chip: "bg-gray-100 text-gray-600" },
};

function formatTime(dateString: string) {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationCard({
  notification,
  onRead,
  onDelete,
  onClick,
}: NotificationCardProps) {
  const style = TYPE_STYLE[notification.type] ?? TYPE_STYLE.system;
  const Icon = style.icon;
  const unread = !notification.read;

  const handleClick = () => {
    if (unread) onRead(notification.id);
    onClick(notification);
  };

  return (
    <div
      onClick={handleClick}
      className={`group relative flex cursor-pointer gap-3 rounded-xl border p-3 pr-8 transition-all hover:shadow-sm ${
        unread ? "border-[#01411C]/15 bg-white" : "border-gray-200 bg-white/60"
      }`}
    >
      {unread && (
        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#01411C]" />
      )}

      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${style.chip}`}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h4
            className={`flex-1 text-sm leading-snug ${
              unread ? "font-semibold text-gray-900" : "font-medium text-gray-600"
            }`}
          >
            {notification.title}
          </h4>
          {unread && (
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#01411C]" />
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
          {notification.message}
        </p>
        <p className="mt-1.5 text-[11px] text-gray-400">
          {formatTime(notification.createdAt)}
        </p>
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          className="absolute right-2 top-2 rounded-md p-1 text-gray-300 opacity-0 transition-all hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100"
          aria-label="Delete notification"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
