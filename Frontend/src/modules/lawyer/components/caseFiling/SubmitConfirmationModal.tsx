import { AlertCircle } from "lucide-react";

type SubmitConfirmationModalProps = {
  open: boolean;
  caseTitle: string;
  registrarName: string;
  submitting: boolean;
  technicalError?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function SubmitConfirmationModal({
  open,
  caseTitle,
  registrarName,
  submitting,
  technicalError,
  onCancel,
  onConfirm,
}: SubmitConfirmationModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">
          Submit Case to Registrar
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          You are about to submit the{" "}
          <span className="font-semibold">complete PDF case file</span> for{" "}
          <span className="font-semibold">{caseTitle}</span> to{" "}
          <span className="font-semibold">{registrarName}</span>. This action
          will mark the case as submitted for registrar review.
        </p>

        {technicalError && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{technicalError}</span>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23] disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {submitting ? "Submitting..." : "Confirm Submission"}
          </button>
        </div>
      </div>
    </div>
  );
}
