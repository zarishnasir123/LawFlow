import { useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type StatusToastProps = {
  open: boolean;
  type?: "success" | "error";
  title: string;
  message?: string;
  onClose: () => void;
  autoCloseMs?: number;
};

export default function StatusToast({
  open,
  type = "success",
  title,
  message,
  onClose,
  autoCloseMs = 3200,
}: StatusToastProps) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onClose, autoCloseMs);
    return () => window.clearTimeout(timer);
  }, [open, onClose, autoCloseMs]);

  if (!open) return null;

  const isSuccess = type === "success";

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-[70] w-full max-w-md">
      <div
        className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-lg ${
          isSuccess
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-rose-200 bg-rose-50 text-rose-900"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 ${
              isSuccess ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{title}</p>
            {message ? <p className="mt-0.5 text-xs">{message}</p> : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-xs text-gray-500 hover:bg-white/70 hover:text-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

