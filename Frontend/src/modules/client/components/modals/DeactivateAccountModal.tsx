import { X } from "lucide-react";
import { useEffect, useState } from "react";

interface DeactivateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  // Driven by the parent's mutation state so the spinner reflects the
  // real network round-trip, not a fake setTimeout. Optional so the
  // modal still works in legacy callers that don't pass it.
  isLoading?: boolean;
  // Surfaces a backend error (e.g. 401, 500) inline. Optional for the
  // same reason as above.
  errorMessage?: string | null;
}

export default function DeactivateAccountModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  errorMessage = null,
}: DeactivateAccountModalProps) {
  const [confirmText, setConfirmText] = useState("");

  // Reset the confirm-text input every time the modal closes so a
  // re-open doesn't show "DEACTIVATE" already typed.
  useEffect(() => {
    if (!isOpen) setConfirmText("");
  }, [isOpen]);

  const isConfirmed = confirmText === "DEACTIVATE";

  const handleConfirm = () => {
    if (!isConfirmed || isLoading) return;
    onConfirm();
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
            <strong>Warning:</strong> Deactivating your account does the
            following:
          </p>
          <ul className="text-sm text-gray-600 space-y-2 ml-4 list-disc">
            <li>You will be signed out of every device immediately</li>
            <li>Your profile and activity become hidden to other users</li>
            <li>
              You have <strong>30 days</strong> to recover the account — just
              sign back in with the same credentials and it will be silently
              reactivated
            </li>
            <li>
              After 30 days the account is{" "}
              <strong>permanently deleted</strong> the next time anyone tries
              to sign in with this email
            </li>
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
            disabled={isLoading}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50"
          />
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

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
