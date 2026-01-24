import { X } from "lucide-react";
import { useState } from "react";

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Preferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  caseUpdates: boolean;
  hearingReminders: boolean;
  messageNotifications: boolean;
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
    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
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
    emailNotifications: true,
    smsNotifications: false,
    caseUpdates: true,
    hearingReminders: true,
    messageNotifications: true,
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Notification Preferences
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <NotificationToggle
            label="Email Notifications"
            description="Receive updates via email"
            checked={preferences.emailNotifications}
            onChange={() => handleToggle("emailNotifications")}
          />
          <NotificationToggle
            label="SMS Notifications"
            description="Receive updates via text message"
            checked={preferences.smsNotifications}
            onChange={() => handleToggle("smsNotifications")}
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
            label="System Updates"
            description="Receive system maintenance notifications"
            checked={preferences.systemUpdates}
            onChange={() => handleToggle("systemUpdates")}
          />
        </div>

        {success && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-600 mb-4">
            {success}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 transition"
          >
            {isSaving ? "Saving..." : "Save Preferences"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
