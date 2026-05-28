import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";

import { apiClient } from "../../../shared/api/axios";
import { clearStoredAuth } from "../utils/authStorage";
import { getAuthErrorMessage } from "../api";
import { useCurrentUser } from "../hooks/useCurrentUser";

type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

async function changePassword(payload: ChangePasswordPayload) {
  const { data } = await apiClient.post("/auth/change-password", payload);
  return data;
}

// Forced password-change page. Triggered the first time a registrar logs in
// with a temporary password (or any user with must_change_password=true).
// Backend revokes the session on success, so we wipe local auth and bounce
// to /login with a one-time success banner — the user signs back in with
// the new password.
export default function ChangeTempPassword() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const passwordRule = useMemo(
    () => /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
    []
  );

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      // Backend already cleared the refresh cookie + revoked the session.
      // Wipe localStorage so the route guards see "logged out" and let us
      // through to /login. Carry a one-shot success flag via sessionStorage
      // so the login page can show "Password changed — please sign in".
      clearStoredAuth();
      // Drop every cached query, including ["currentUser"]. Without this
      // wipe, the useCurrentUser cache still holds mustChangePassword=true
      // (staleTime is 5 min) — so on the next sign-in the dashboard's
      // useEnforcePasswordChange hook reads the stale flag and bounces
      // the user right back to this page on the first attempt. The
      // second attempt only worked because a remount eventually
      // refetched /auth/me. Matches the pattern used by the in-profile
      // ChangePasswordModal for client / lawyer / registrar.
      queryClient.clear();
      try {
        sessionStorage.setItem("lawflow_password_change_success", "1");
      } catch {
        // ignored — non-critical UI nicety
      }
      navigate({ to: "/login" });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setClientError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setClientError("All three fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setClientError("New password and confirm password must match.");
      return;
    }
    if (newPassword === currentPassword) {
      setClientError("New password must be different from the temporary password.");
      return;
    }
    if (!passwordRule.test(newPassword)) {
      setClientError(
        "Password must be at least 8 characters and include one number and one special character."
      );
      return;
    }

    mutation.mutate({ currentPassword, newPassword, confirmPassword });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-md ring-1 ring-gray-200 p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="rounded-2xl bg-green-100 p-3 mb-4">
            <KeyRound className="h-6 w-6 text-[var(--primary)]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Set your new password
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            For security, you must replace the temporary password sent to your email
            {currentUser?.email ? <> (<span className="font-medium">{currentUser.email}</span>)</> : null}
            {" "}before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1.5">
              Temporary password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Paste the temporary password from your email"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none transition"
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1.5">
              New password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Choose a new password"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none transition"
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-gray-500">
              At least 8 characters, with one number and one special character.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1.5">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-type the new password"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none transition"
              autoComplete="new-password"
            />
          </div>

          {clientError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {clientError}
            </div>
          ) : null}

          {mutation.isError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {getAuthErrorMessage(mutation.error)}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full px-6 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-semibold hover:bg-[#024A23] transition disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm shadow-green-100"
          >
            {mutation.isPending ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
