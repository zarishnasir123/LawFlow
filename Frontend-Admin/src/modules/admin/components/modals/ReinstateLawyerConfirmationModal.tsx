import { useEffect } from "react";
import { X, RotateCcw } from "lucide-react";

interface ReinstateLawyerConfirmationModalProps {
  open: boolean;
  lawyerName: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ReinstateLawyerConfirmationModal({
  open,
  lawyerName,
  isSubmitting = false,
  onCancel,
  onConfirm,
}: ReinstateLawyerConfirmationModalProps) {
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

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <RotateCcw className="text-green-700" />
        </div>

        <h2 className="text-center text-xl font-semibold text-gray-900">
          Reinstate Lawyer Account?
        </h2>

        <p className="mt-2 text-center text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{lawyerName}</span> will be
          able to sign in again and resume LawFlow services. The previous suspension
          reason will be cleared.
        </p>

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
            className="flex-1 rounded-lg bg-[#01411C] py-2 font-medium text-white hover:bg-[#025227] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Reinstating..." : "Yes, Reinstate"}
          </button>
        </div>
      </div>
    </div>
  );
}
