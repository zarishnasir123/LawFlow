import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearch } from "@tanstack/react-router";

import AuthShell from "../components/AuthShell";
import PasswordField from "../components/PasswordField";
import { authApi, getAuthErrorMessage } from "../api";

type ResetPasswordValues = {
  password: string;
  confirmPassword: string;
};

export default function ResetPassword() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/reset-password" }) as { token?: string };

  // Capture the token once on mount, then strip it from the URL so it doesn't
  // linger in history, the Referer header, or server logs.
  const tokenRef = useRef<string | undefined>(search.token);
  useEffect(() => {
    if (search.token && typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const token = tokenRef.current;

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    defaultValues: { password: "", confirmPassword: "" },
  });

  const password = watch("password");

  const submit = async (values: ResetPasswordValues) => {
    if (!token) {
      setError("Reset token is missing. Please use the link from your email.");
      return;
    }
    try {
      setError(null);
      await authApi.resetPassword({
        token,
        password: values.password,
        confirmPassword: values.confirmPassword,
      });
      setSubmitted(true);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    }
  };

  if (submitted) {
    return (
      <AuthShell
        title="Password reset complete"
        subtitle="Your password has been successfully updated."
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-[var(--primary)]">
            <CheckCircle className="h-6 w-6" />
          </div>
          <p className="text-sm text-gray-600">
            You can now log in to the admin portal with your new password.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/login" })}
            className="w-full rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#024a23]"
          >
            Log in now
          </button>
        </div>
      </AuthShell>
    );
  }

  if (!token) {
    return (
      <AuthShell
        title="Invalid link"
        subtitle="This password reset link is invalid or has expired."
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Lock className="h-6 w-6" />
          </div>
          <p className="text-sm text-gray-600">
            Please request a new reset link from the forgot-password page.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/forgot-password" })}
            className="w-full rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#024a23]"
          >
            Go to forgot password
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create new password"
      subtitle="Your new password must differ from previous ones."
    >
      <form
        onSubmit={handleSubmit(submit)}
        className="space-y-5"
        autoComplete="off"
      >
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-[var(--primary)]">
            <Lock className="h-6 w-6" />
          </div>
        </div>

        <PasswordField
          id="password"
          label="New Password"
          placeholder="At least 8 chars, 1 number, 1 symbol"
          autoComplete="new-password"
          disabled={isSubmitting}
          error={errors.password?.message}
          inputProps={register("password", {
            required: "Password is required.",
            pattern: {
              value: /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
              message: "Must be 8+ chars with a number and special character.",
            },
          })}
        />

        <PasswordField
          id="confirmPassword"
          label="Confirm New Password"
          placeholder="Re-enter your new password"
          autoComplete="new-password"
          disabled={isSubmitting}
          error={errors.confirmPassword?.message}
          inputProps={register("confirmPassword", {
            required: "Please confirm your password.",
            validate: (value) =>
              value === password || "Passwords do not match.",
          })}
        />

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#024a23] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Updating password..." : "Reset password"}
        </button>

        <button
          type="button"
          onClick={() => navigate({ to: "/login" })}
          className="mx-auto flex items-center justify-center gap-2 text-sm text-gray-500 transition hover:text-[var(--primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </button>
      </form>
    </AuthShell>
  );
}
