import { useEffect, useState } from "react";
import { X, Ban } from "lucide-react";

interface SuspendLawyerConfirmationModalProps {
  open: boolean;
  lawyerName: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export default function SuspendLawyerConfirmationModal({
  open,
  lawyerName,
  isSubmitting = false,
  onCancel,
  onConfirm,
}: SuspendLawyerConfirmationModalProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
      setReason("");
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  if (!open) return null;

  const canSubmit = reason.trim().length > 0 && !isSubmitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          <X size={20} />
        </button>

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <Ban className="text-amber-600" />
        </div>

        <h2 className="text-center text-xl font-semibold text-gray-900">
          Suspend Lawyer Account?
        </h2>

        <p className="mt-2 text-center text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{lawyerName}</span> will be
          blocked from signing in. Their data and case history remain intact and you
          can reinstate them later.
        </p>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">
            Reason (sent to the lawyer)
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            disabled={isSubmitting}
            placeholder="e.g. Disciplinary review in progress for case #LF-2024-118."
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:opacity-50"
          />
        </label>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-300 py-2 font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={() => canSubmit && onConfirm(reason.trim())}
            disabled={!canSubmit}
            className="flex-1 rounded-lg bg-amber-600 py-2 font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Suspending..." : "Suspend"}
          </button>
        </div>
      </div>
    </div>
  );
}
