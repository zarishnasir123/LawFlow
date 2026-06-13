import { useState } from "react";
import { X, Trash2, AlertCircle } from "lucide-react";

interface DeleteCaseModalProps {
  // Shown in the warning copy so the lawyer can confirm they're deleting
  // the right case before typing the destructive confirmation word.
  caseTitle: string;
  onClose: () => void;
  onConfirm: () => void;
  // Driven by the parent's delete mutation so the button spinner reflects
  // the real network round-trip.
  isLoading?: boolean;
  // Surfaces a backend error (e.g. the 409 when the case has linked
  // payment records) inline inside the modal.
  errorMessage?: string | null;
}

// Typed-confirmation gate: the destructive confirm button stays disabled
// until the user types exactly "DELETE" (capitals). Mirrors the
// DeactivateAccountModal pattern so the destructive-action UX is
// consistent across the lawyer app.
//
// The parent only mounts this component while the modal is open, so the
// confirm input naturally resets to "" on every open — no reset effect
// needed (which keeps us clear of react-hooks/set-state-in-effect).
const CONFIRM_WORD = "DELETE";

export default function DeleteCaseModal({
  caseTitle,
  onClose,
  onConfirm,
  isLoading = false,
  errorMessage = null,
}: DeleteCaseModalProps) {
  const [confirmText, setConfirmText] = useState("");

  const isConfirmed = confirmText === CONFIRM_WORD;

  const handleConfirm = () => {
    if (!isConfirmed || isLoading) return;
    onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-md"
      onClick={() => {
        if (!isLoading) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-red-600">
            <Trash2 className="h-5 w-5" />
            Delete Case
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 transition hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6 rounded-md bg-red-50 p-4">
          <p className="mb-3 text-sm text-gray-700">
            <strong>Warning:</strong> You are about to permanently delete{" "}
            <span className="font-semibold text-gray-900">{caseTitle}</span>.
            This action:
          </p>
          <ul className="ml-4 list-disc space-y-2 text-sm text-gray-600">
            <li>
              Removes the case <strong>entirely from the system</strong> — this
              cannot be undone
            </li>
            <li>
              Deletes its document, attachments, and signature requests along
              with it
            </li>
          </ul>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Type <span className="font-semibold text-red-600">DELETE</span> to
            confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            placeholder="Type DELETE"
            disabled={isLoading}
            autoFocus
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50"
          />
        </div>

        {errorMessage && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={!isConfirmed || isLoading}
            className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Deleting..." : "Delete Case"}
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
