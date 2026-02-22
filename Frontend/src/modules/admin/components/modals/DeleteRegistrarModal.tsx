import { AlertTriangle } from "lucide-react";

type DeleteRegistrarModalProps = {
  open: boolean;
  registrarName?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteRegistrarModal({
  open,
  registrarName,
  onCancel,
  onConfirm,
}: DeleteRegistrarModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-full bg-rose-100 p-2 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Delete Registrar Account
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-gray-900">
                {registrarName ?? "this registrar"}
              </span>
              ? This action cannot be undone.
            </p>
            <p className="mt-2 text-xs text-amber-700">
              Note: active registrar accounts must be deactivated before deletion.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}

