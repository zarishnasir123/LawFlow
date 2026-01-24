import { X } from "lucide-react";
import { useState } from "react";

interface DeactivateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeactivateAccountModal({
  isOpen,
  onClose,
  onConfirm,
}: DeactivateAccountModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isConfirmed = confirmText === "DEACTIVATE";

  const handleConfirm = () => {
    if (!isConfirmed) return;
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      onConfirm();
    }, 1000);
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
          <h2 className="text-lg font-semibold text-red-600">
            Deactivate Account
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6 rounded-md bg-red-50 p-4">
          <p className="text-sm text-gray-700 mb-3">
            <strong>Warning:</strong> Deactivating your account is a serious
            action. Once you proceed:
          </p>
          <ul className="text-sm text-gray-600 space-y-2 ml-4 list-disc">
            <li>Your account will be permanently deactivated</li>
            <li>All your profile data will be archived</li>
            <li>You won't be able to access any services</li>
            <li>This action cannot be undone</li>
          </ul>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type <span className="font-semibold text-red-600">DEACTIVATE</span>{" "}
            to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            placeholder="Type DEACTIVATE"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={!isConfirmed || isLoading}
            className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? "Deactivating..." : "Deactivate Account"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
