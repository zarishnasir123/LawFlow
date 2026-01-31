import { Bell, X } from "lucide-react";
import { useEffect, useState } from "react";

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Preferences {
  gmailNotifications: boolean;
  caseUpdates: boolean;
  hearingReminders: boolean;
  messageNotifications: boolean;
  documentNotifications: boolean;
  systemUpdates: boolean;
}

interface NotificationToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

function NotificationToggle({
  label,
  description,
  checked,
  onChange,
}: NotificationToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? "bg-green-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function NotificationPreferencesModal({
  isOpen,
  onClose,
}: NotificationPreferencesModalProps) {
  const [preferences, setPreferences] = useState<Preferences>({
    gmailNotifications: true,
    caseUpdates: true,
    hearingReminders: true,
    messageNotifications: true,
    documentNotifications: true,
    systemUpdates: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState("");

  const handleToggle = (key: keyof Preferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = () => {
    setIsSaving(true);
    // Simulate API call
    setTimeout(() => {
      setSuccess("Preferences saved successfully");
      setIsSaving(false);
      setTimeout(() => {
        setSuccess("");
        onClose();
      }, 1500);
    }, 800);
  };

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-end bg-black/30 backdrop-blur-[2px] sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        className="relative h-[600px] w-full max-w-md rounded-t-lg bg-gradient-to-b from-white to-slate-50 shadow-[0_24px_60px_rgba(15,23,42,0.28)] ring-1 ring-black/5 sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-slate-200 px-6 pt-6 pb-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Bell className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            Notification Preferences
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Choose what alerts you want to receive.
          </p>
        </div>

        <div className="flex h-[calc(100%-156px)] flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <NotificationToggle
            label="Gmail Notifications"
            description="Receive updates via Gmail"
            checked={preferences.gmailNotifications}
            onChange={() => handleToggle("gmailNotifications")}
          />
          <NotificationToggle
            label="Case Updates"
            description="Get notified about case status changes"
            checked={preferences.caseUpdates}
            onChange={() => handleToggle("caseUpdates")}
          />
          <NotificationToggle
            label="Hearing Reminders"
            description="Receive reminders for upcoming hearings"
            checked={preferences.hearingReminders}
            onChange={() => handleToggle("hearingReminders")}
          />
          <NotificationToggle
            label="Message Notifications"
            description="Get notified about new messages"
            checked={preferences.messageNotifications}
            onChange={() => handleToggle("messageNotifications")}
          />
          <NotificationToggle
            label="Document Requests"
            description="Get notified about document sharing and signing"
            checked={preferences.documentNotifications}
            onChange={() => handleToggle("documentNotifications")}
          />
          <NotificationToggle
            label="System Updates"
            description="Receive system maintenance notifications"
            checked={preferences.systemUpdates}
            onChange={() => handleToggle("systemUpdates")}
          />
          </div>

          <div className="border-t border-slate-200 px-6 py-4">
            {success && (
              <div className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                {success}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {isSaving ? "Saving..." : "Save Preferences"}
              </button>
              <button
                onClick={onClose}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
