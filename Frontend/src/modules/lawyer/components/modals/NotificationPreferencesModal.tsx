import { Mail, X } from "lucide-react";

import NotificationPreferencesPanel from "./NotificationPreferencesPanel";

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Center modal used from the Profile page + the full Notifications page. It's a
// thin wrapper around the shared (real, wired) NotificationPreferencesPanel.
// The notification bell uses an in-drawer Settings view instead of this modal.
export default function NotificationPreferencesModal({
  isOpen,
  onClose,
}: NotificationPreferencesModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#01411C]/10 p-2 text-[#01411C]">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Notification Preferences
              </h2>
              <p className="text-xs text-gray-500">Choose which emails you receive</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto">
          <NotificationPreferencesPanel onSaved={onClose} />
        </div>
      </div>
    </div>
  );
}
