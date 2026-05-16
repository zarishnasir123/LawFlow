import { useEffect } from "react";
import { X, XCircle } from "lucide-react";

interface RejectLawyerConfirmationModalProps {
  open: boolean;
  lawyerName: string;
  remarks: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function RejectLawyerConfirmationModal({
  open,
  lawyerName,
  remarks,
  isSubmitting = false,
  onCancel,
  onConfirm,
}: RejectLawyerConfirmationModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  if (!open) return null;

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

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <XCircle className="text-red-600" />
        </div>

        <h2 className="text-center text-xl font-semibold text-gray-900">
          Reject Lawyer Registration?
        </h2>

        <p className="mt-2 text-center text-sm text-gray-600">
          This deletes <span className="font-semibold text-gray-900">{lawyerName}</span>'s
          submission and uploaded documents. They will need to register again from scratch.
        </p>

        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
            Rejection reason (sent to applicant)
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-rose-900">{remarks}</p>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-300 py-2 font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-red-600 py-2 font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Rejecting..." : "Yes, Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}
