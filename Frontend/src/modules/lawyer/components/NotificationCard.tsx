import {
  AlertCircle,
  Clock,
  FileText,
  MessageSquare,
  Calendar,
  X,
} from "lucide-react";
import type { Notification } from "../types/notification";

interface NotificationCardProps {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (notification: Notification) => void;
}

export default function NotificationCard({
  notification,
  onRead,
  onDelete,
  onClick,
}: NotificationCardProps) {
  const getIcon = () => {
    switch (notification.type) {
      case "case":
        return <AlertCircle className="h-5 w-5 text-blue-500" />;
      case "hearing":
        return <Calendar className="h-5 w-5 text-purple-500" />;
      case "message":
        return <MessageSquare className="h-5 w-5 text-green-500" />;
      case "document":
        return <FileText className="h-5 w-5 text-orange-500" />;
      case "system":
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTypeColor = () => {
    switch (notification.type) {
      case "case":
        return "bg-blue-50 border-blue-200";
      case "hearing":
        return "bg-purple-50 border-purple-200";
      case "message":
        return "bg-green-50 border-green-200";
      case "document":
        return "bg-orange-50 border-orange-200";
      case "system":
        return "bg-gray-50 border-gray-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const handleNotificationClick = () => {
    if (!notification.read) {
      onRead(notification.id);
    }
    onClick(notification);
  };

  return (
    <div
      onClick={handleNotificationClick}
      className={`mb-3 flex cursor-pointer gap-3 rounded-lg border p-3 transition-all hover:shadow-md ${getTypeColor()} ${
        !notification.read ? "border-opacity-100 shadow-sm" : "border-opacity-50"
      }`}
    >
      <div className="mt-1 flex-shrink-0">{getIcon()}</div>

      <div className="flex-1 min-w-0">
        <h4 className={`text-sm font-medium ${!notification.read ? "text-gray-900" : "text-gray-700"}`}>
          {notification.title}
        </h4>
        <p className="mt-1 line-clamp-2 text-xs text-gray-600">{notification.message}</p>
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          {formatTime(notification.createdAt)}
        </div>
      </div>

      {!notification.read && (
        <div className="mt-1 flex-shrink-0">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
        </div>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
        className="mt-1 flex-shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
        aria-label="Delete notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
