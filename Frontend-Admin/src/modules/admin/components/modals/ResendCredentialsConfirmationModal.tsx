import { KeyRound } from "lucide-react";

type ResendCredentialsConfirmationModalProps = {
  open: boolean;
  registrarName?: string;
  registrarEmail?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

// Send credentials = generate a fresh temporary password + email it. Any
// password previously sent (including the one auto-mailed at account
// creation) is invalidated the moment this runs. The dialog exists so an
// admin who clicks Send by reflex doesn't silently lock the registrar out
// of credentials that were already in transit.
export default function ResendCredentialsConfirmationModal({
  open,
  registrarName,
  registrarEmail,
  onCancel,
  onConfirm,
}: ResendCredentialsConfirmationModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-full bg-amber-100 p-2 text-amber-700">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Send new credentials?
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              This will generate a <span className="font-semibold">new temporary password</span> for{" "}
              <span className="font-semibold text-gray-900">
                {registrarName ?? "this registrar"}
              </span>
              {registrarEmail ? (
                <>
                  {" "}and email it to{" "}
                  <span className="font-medium text-gray-900">{registrarEmail}</span>
                </>
              ) : null}
              .
            </p>
            <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              ⚠️ Any previously emailed temporary password — including the one sent at account creation — will stop working immediately. Only use this if the registrar reports they never received the original email or it expired.
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
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Send New Credentials
          </button>
        </div>
      </div>
    </div>
  );
}
