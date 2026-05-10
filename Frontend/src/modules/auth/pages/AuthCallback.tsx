import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { apiClient } from "../../../shared/api/axios";
import { saveStoredAuthUser } from "../utils/authStorage";

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

export default function AuthCallback() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ranRef = useRef(false);

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
        const { user, accessToken, refreshTokenExpiresAt } = response.data;
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
        ) : (
          <>
            <h1 className="text-lg font-semibold text-gray-900">Signing you in…</h1>
            <p className="mt-2 text-sm text-gray-600">
              Just a moment while we finish setting up your session.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
