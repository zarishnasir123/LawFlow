import { ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authApi, getAuthErrorMessage } from "../../../auth/api";
import { useCurrentUser } from "../../../auth/hooks/useCurrentUser";
import { clearStoredAuth } from "../../../auth/utils/authStorage";

// Where to send Google users who want to rotate their password.
// Google account settings is the official URL — it deep-links into
// the security section by default.
const GOOGLE_ACCOUNT_SECURITY_URL = "https://myaccount.google.com/security";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Same password rule the backend enforces (auth.validators.js:500):
// at least 8 characters, at least one digit, at least one
// non-alphanumeric character. Mirroring it here means the user
// sees the validation error before a network round-trip, and the
// backend stays the source of truth — it will still reject
// anything that slips past us.
const STRONG_PASSWORD_PATTERN = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// Key the LoginForm already reads on mount to show a one-shot
// "Password changed successfully" banner. Defined inline so a
// future contributor doesn't have to chase the constant down — if
// the LoginForm side ever changes, this needs to change too.
const PASSWORD_CHANGE_SUCCESS_FLAG = "lawflow_password_change_success";

export default function ChangePasswordModal({
  isOpen,
  onClose,
}: ChangePasswordModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Read the current user so the modal can swap to the Google-user
  // panel when there's no local password to change. The cache is
  // already warm from the profile page, so no extra fetch — and
  // when it isn't (race during cache clear) we just render the
  // password form which the backend will gracefully 403.
  const { data: currentUser } = useCurrentUser();
  const isGoogleUser = currentUser?.authProvider === "google";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  // Wipe the form every time the modal closes so re-opening doesn't
  // leak the previous attempt's input. Errors clear too because they
  // refer to those inputs.
  useEffect(() => {
    if (!isOpen) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
    }
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      // Backend revokes every refresh session in the same transaction
      // it writes the new hash, so we have to clear local auth state
      // too — otherwise the redirectIfAuthenticated guard would bounce
      // the user back into the dashboard with a now-stale access token.
      clearStoredAuth();
      queryClient.clear();
      try {
        sessionStorage.setItem(PASSWORD_CHANGE_SUCCESS_FLAG, "1");
      } catch {
        // Storage may be disabled (Safari private mode); banner is a
        // nicety, not a security signal — swallow the failure.
      }
      onClose();
      navigate({ to: "/login" });
    },
    onError: (err) => {
      setError(getAuthErrorMessage(err));
    },
  });

  const validate = (): boolean => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All fields are required");
      return false;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return false;
    }

    if (!STRONG_PASSWORD_PATTERN.test(newPassword)) {
      setError(
        "New password must be at least 8 characters and include one number and one special character"
      );
      return false;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from your current password");
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validate()) return;

    mutation.mutate({
      currentPassword,
      newPassword,
      confirmPassword,
    });
  };

  if (!isOpen) return null;

  const isLoading = mutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md"
      onClick={() => {
        if (!isLoading) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Change Password
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Google-OAuth users have no local password to rotate.
            Replace the form with a plain-English explanation + a
            link to Google's password-management page. We don't try
            to be clever and call /auth/change-password "just in
            case"; the backend would 403 with a less friendly
            message and the user would have to read it twice. */}
        {isGoogleUser ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 leading-relaxed">
              You signed in with <strong>Google</strong>, so your password is
              managed by your Google account — not by LawFlow. We never see
              or store your Google password.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              To change it, go to your Google Account → Security → Password.
              The button below opens that page in a new tab.
            </p>
            <a
              href={GOOGLE_ACCOUNT_SECURITY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 transition"
            >
              Open Google Account Security
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-50"
              placeholder="Enter your current password"
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-50"
              placeholder="Enter new password"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-50"
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 transition"
            >
              {isLoading ? "Updating..." : "Change Password"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              Cancel
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
