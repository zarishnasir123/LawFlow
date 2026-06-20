import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

type DeleteCaseTypeModalProps = {
  open: boolean;
  caseTypeName: string;
  // True when real cases reference this type — deletion is blocked entirely.
  inUse: boolean;
  caseCount: number;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

// Sensitive action: deleting a case type removes it (and its uploaded template)
// for good. We require the admin to type the exact name to confirm, and we
// block the action outright when cases still use the type.
export default function DeleteCaseTypeModal({
  open,
  caseTypeName,
  inUse,
  caseCount,
  deleting,
  onCancel,
  onConfirm,
}: DeleteCaseTypeModalProps) {
  const [typed, setTyped] = useState("");
  const [wasOpen, setWasOpen] = useState(open);

  // Clear the typed confirmation when the modal transitions closed -> open so a
  // previous attempt's text never carries over to a different case type. Done
  // with set-during-render (React's recommended pattern) rather than an effect.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTyped("");
  }

  if (!open) return null;

  const matches = typed.trim() === caseTypeName.trim();
  const canDelete = !inUse && matches && !deleting;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-full bg-rose-100 p-2 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">
              Delete Case Type
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              This permanently removes{" "}
              <span className="font-semibold text-gray-900">{caseTypeName}</span>{" "}
              and any template uploaded for it. This cannot be undone.
            </p>
          </div>
        </div>

        {inUse ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            This case type can&apos;t be deleted because{" "}
            <span className="font-semibold">
              {caseCount} case{caseCount === 1 ? "" : "s"}
            </span>{" "}
            still use it. Existing case history is protected.
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Type the case type name to confirm
            </label>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={caseTypeName}
              autoFocus
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
            />
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canDelete}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Delete Case Type
          </button>
        </div>
      </div>
    </div>
  );
}
