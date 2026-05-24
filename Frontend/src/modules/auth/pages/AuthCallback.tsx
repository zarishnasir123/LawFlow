import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "../../../shared/api/axios";
import { saveStoredAuthUser } from "../utils/authStorage";
import { authApi, getAuthErrorMessage } from "../api";
import type { LoginSuccessResponse } from "../types";
import ReactivateAccountModal from "../components/ReactivateAccountModal";

const errorMessages: Record<string, string> = {
  invalid_state: "Sign-in expired or was tampered with. Please try again.",
  auth_failed: "Google sign-in failed. Please try again.",
  email_exists: "An account with this email already exists. Please sign in with your password.",
  sync_failed: "We could not finish setting up your account. Please try again.",
};

function parseHash(hash: string) {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return {
    accessToken: params.get("access_token"),
    error: params.get("error"),
    errorDescription: params.get("error_description"),
  };
}

// Shared finalizer: takes a login-success payload (from either the
// initial /auth/google/session call or the post-modal /auth/reactivate
// call) and writes the session to local storage + navigates to the
// client dashboard. Kept inline so we don't have to thread the
// navigate hook through a helper module.
function persistAndNavigate(
  data: LoginSuccessResponse,
  navigate: ReturnType<typeof useNavigate>
) {
  const { user, accessToken, refreshTokenExpiresAt } = data;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  saveStoredAuthUser(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: fullName || user.email,
      refreshTokenExpiresAt,
    },
    false,
    accessToken
  );
  // Wipe the hash before navigating so the access token leaves the URL bar.
  window.history.replaceState(null, "", window.location.pathname);
  navigate({ to: "/client-dashboard" });
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reactivationToken, setReactivationToken] = useState<string | null>(null);
  const [reactivateError, setReactivateError] = useState<string | null>(null);
  const ranRef = useRef(false);

  // Reactivation mutation — fired when the user confirms in the modal.
  const reactivateMutation = useMutation({
    mutationFn: authApi.reactivateAccount,
    onSuccess: (data) => {
      setReactivationToken(null);
      setReactivateError(null);
      persistAndNavigate(data, navigate);
    },
    onError: (err) => {
      setReactivateError(getAuthErrorMessage(err));
    },
  });

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const search = new URLSearchParams(window.location.search);
    const state = search.get("state");
    const queryError = search.get("error");
    const hash = parseHash(window.location.hash);

    if (hash.error || queryError) {
      const code = hash.error ?? queryError ?? "auth_failed";
      setErrorMessage(errorMessages[code] ?? "Sign-in failed. Please try again.");
      return;
    }

    if (!hash.accessToken) {
      setErrorMessage("Sign-in failed. Please try again.");
      return;
    }

    if (!state) {
      setErrorMessage(errorMessages.invalid_state);
      return;
    }

    apiClient
      .post("/auth/google/session", { accessToken: hash.accessToken, state })
      .then((response) => {
        // Backend may respond with one of two shapes (both 200):
        //   • normal session payload
        //   • { reactivationRequired: true, reactivationToken } when
        //     the account is inside the 30-day recovery window
        // The hash is cleared in either case so the access token
        // doesn't linger in the URL bar.
        window.history.replaceState(null, "", window.location.pathname);

        if (response.data?.reactivationRequired) {
          setReactivationToken(response.data.reactivationToken);
          return;
        }

        persistAndNavigate(response.data as LoginSuccessResponse, navigate);
      })
      .catch((err) => {
        const status = err?.response?.status;
        const code = status === 409 ? "email_exists" : status === 403 ? "invalid_state" : "sync_failed";
        setErrorMessage(errorMessages[code]);
      });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        {errorMessage ? (
          <>
            <h1 className="text-lg font-semibold text-gray-900">Sign-in failed</h1>
            <p className="mt-2 text-sm text-gray-600">{errorMessage}</p>
            <button
              type="button"
              onClick={() => navigate({ to: "/login" })}
              className="mt-6 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23]"
            >
              Back to login
            </button>
          </>
        ) : reactivationToken ? (
          // While the recovery modal is open the OAuth verification
          // is already done — just show a quiet hint behind it so the
          // page isn't blank if the modal is dismissed by accident.
          <>
            <h1 className="text-lg font-semibold text-gray-900">
              Account requires reactivation
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Confirm in the dialog to continue, or close it to cancel sign-in.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-gray-900">Signing you in…</h1>
            <p className="mt-2 text-sm text-gray-600">
              Just a moment while we finish setting up your session.
            </p>
          </>
        )}
      </div>

      {/* Same reactivation dialog as the password login form.
          Cancelling clears the token and sends the user back to
          /login so they can decide what to do next. */}
      <ReactivateAccountModal
        isOpen={Boolean(reactivationToken)}
        onClose={() => {
          if (reactivateMutation.isPending) return;
          setReactivationToken(null);
          setReactivateError(null);
          navigate({ to: "/login" });
        }}
        onConfirm={() => {
          if (!reactivationToken) return;
          reactivateMutation.mutate(reactivationToken);
        }}
        isLoading={reactivateMutation.isPending}
        errorMessage={reactivateError}
      />
    </div>
  );
}
