import { X } from "lucide-react";

// Account-deactivation recovery confirmation. The user just signed
// in (with password or Google) and the backend detected their
// account is in the 30-day recovery window. We show them the
// status + give them an explicit choice — silent reactivation
// would be surprising and removes their ability to back out.
//
// "Continue & Reactivate Account" → caller fires authApi.reactivateAccount(token)
// "Cancel"                       → caller closes the modal; nothing changes
//
// All state is owned by the parent (loading / error from its
// mutation). The modal is pure presentation so both the Login page
// and the Google AuthCallback page can share it.

// Recovery window in days. Must stay in sync with the backend's
// DEACTIVATION_RECOVERY_WINDOW_DAYS constant in auth.service.js —
// hardcoded here so the modal can render an accurate countdown
// without an extra round-trip to fetch the value.
const RECOVERY_WINDOW_DAYS = 30;

interface ReactivateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  // ISO timestamp of when the user deactivated, sourced from the
  // backend's reactivation prompt. We compute days-remaining
  // inside this component so callers don't have to bake in the
  // window length. Optional so a missing/invalid value just hides
  // the countdown line instead of breaking the dialog.
  deactivatedAt?: string | null;
  // True while the parent's reactivate mutation is in flight; the
  // confirm button shows a spinner and Cancel is disabled.
  isLoading?: boolean;
  // Optional error from the parent's mutation (e.g. token expired,
  // 410 if the window closed between login and confirm).
  errorMessage?: string | null;
}

// Returns the integer days remaining before the account is
// permanently deleted, or null when we can't compute it (missing /
// unparseable timestamp, already past the window). Math:
//   daysUsed = floor((now - deactivatedAt) / 1 day)
//   remaining = WINDOW - daysUsed
// We floor on daysUsed so a 29.6-day-old deactivation still shows
// "1 day remaining" rather than "0", matching how the backend's
// >30 check rounds.
function daysRemainingUntilDeletion(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const deactivated = new Date(iso).getTime();
  if (!Number.isFinite(deactivated)) return null;
  const ageDays = Math.floor((Date.now() - deactivated) / (1000 * 60 * 60 * 24));
  const remaining = RECOVERY_WINDOW_DAYS - ageDays;
  return remaining > 0 ? remaining : null;
}

export default function ReactivateAccountModal({
  isOpen,
  onClose,
  onConfirm,
  deactivatedAt = null,
  isLoading = false,
  errorMessage = null,
}: ReactivateAccountModalProps) {
  if (!isOpen) return null;

  const daysLeft = daysRemainingUntilDeletion(deactivatedAt);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
      onClick={() => {
        if (!isLoading) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Your account has been deactivated.
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* The body copy is the exact wording the spec called for. */}
        <p className="text-sm leading-relaxed text-gray-600">
          If you recently requested account deactivation, you can reactivate
          your account by continuing to log in within the recovery period.
          Otherwise, your account data and access may be permanently removed
          after the deactivation period ends.
        </p>

        {/* Concrete countdown: gives the user the exact urgency
            without making them do the date math. Hidden when we
            don't have a deactivatedAt timestamp (legacy flows) or
            when the window has already closed (the backend would
            have 410'd before reaching this modal — defensive). */}
        {daysLeft !== null && (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            If you don't reactivate, your account will be permanently deleted in{" "}
            <strong>
              {daysLeft} {daysLeft === 1 ? "day" : "days"}
            </strong>
            .
          </p>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Reactivating…" : "Continue & Reactivate Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
