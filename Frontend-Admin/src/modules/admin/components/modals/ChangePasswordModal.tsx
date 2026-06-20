import { Eye, EyeOff, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authApi, getAuthErrorMessage } from "../../../auth/api";
import { clearStoredAuth } from "../../../auth/utils/authStorage";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Same rule the backend enforces (auth.validators.js): at least 8 characters,
// at least one digit, at least one non-alphanumeric character. Mirroring it
// here surfaces the error before a round-trip; the backend stays authoritative.
const STRONG_PASSWORD_PATTERN = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function ChangePasswordModal({
  isOpen,
  onClose,
}: ChangePasswordModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);

  // Reset on every close (rather than via an effect) so the next open starts
  // clean. The first open is already clean from initial state.
  const handleClose = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setShow(false);
    onClose();
  };

  const mutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      // Backend revokes every refresh session in the same transaction it writes
      // the new hash. Clear local auth so the route guard doesn't bounce the
      // admin back in with a stale access token, then send them to login.
      clearStoredAuth();
      queryClient.clear();
      onClose();
      navigate({ to: "/login" });
    },
    onError: (err) => {
      setError(getAuthErrorMessage(err));
    },
  });

  const validate = (): boolean => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All fields are required.");
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return false;
    }
    if (!STRONG_PASSWORD_PATTERN.test(newPassword)) {
      setError(
        "New password must be at least 8 characters and include one number and one special character."
      );
      return false;
    }
    if (currentPassword === newPassword) {
      setError("New password must be different from your current password.");
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    mutation.mutate({ currentPassword, newPassword, confirmPassword });
  };

  if (!isOpen) return null;

  const isLoading = mutation.isPending;
  const inputClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-green-100 disabled:bg-gray-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={() => {
        if (!isLoading) handleClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          For your security, you'll be signed out on all devices after changing
          your password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="mb-1 block text-xs font-semibold text-gray-700">
              Current Password
            </label>
            <input
              type={show ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isLoading}
              className={inputClass}
              placeholder="Enter your current password"
              autoComplete="current-password"
            />
          </div>

          <div className="relative">
            <label className="mb-1 block text-xs font-semibold text-gray-700">
              New Password
            </label>
            <input
              type={show ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
              className={inputClass}
              placeholder="At least 8 chars, 1 number, 1 symbol"
              autoComplete="new-password"
            />
          </div>

          <div className="relative">
            <label className="mb-1 block text-xs font-semibold text-gray-700">
              Confirm New Password
            </label>
            <input
              type={show ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              className={inputClass}
              placeholder="Re-enter your new password"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-[34px] rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label={show ? "Hide passwords" : "Show passwords"}
              tabIndex={-1}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#024a23] disabled:opacity-50"
            >
              {isLoading ? "Updating..." : "Change Password"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
