import { useState } from "react";
import { ArrowLeft, CheckCircle, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearch } from "@tanstack/react-router";
import AuthForm from "../components/AuthForm";
import PasswordField from "../components/PasswordField";
import { authApi, getAuthErrorMessage } from "../api";

type ResetPasswordValues = {
  password: string;
  confirmPassword: string;
};

export default function ResetPassword() {
  const navigate = useNavigate();
  // We assume the route is configured to accept 'token' in search params
  const search = useSearch({ from: "/reset-password" }) as { token?: string };
  const token = search.token;

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
      setError("Reset token is missing. Please check your email link.");
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
    } catch (err: any) {
      const message = getAuthErrorMessage(err);
      setError(message);
    }
  };

  const footer = (
    <div className="space-y-3 text-center text-sm text-gray-600">
      <button
        type="button"
        onClick={() => navigate({ to: "/login" })}
        className="inline-flex items-center justify-center gap-2 text-gray-500 hover:text-[var(--primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to login
      </button>
    </div>
  );

  if (submitted) {
    return (
      <AuthForm
        title="Password Reset Complete"
        subtitle="Your password has been successfully updated."
        mode="custom"
        footer={footer}
        maxWidthClassName="max-w-md"
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-[var(--primary)]">
            <CheckCircle className="h-6 w-6" />
          </div>
          <p className="text-sm text-gray-600">
            You can now log in to your LawFlow account with your new password.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/login" })}
            className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#024a23]"
          >
            Log in Now
          </button>
        </div>
      </AuthForm>
    );
  }

  if (!token) {
    return (
      <AuthForm
        title="Invalid Link"
        subtitle="This password reset link is invalid or has expired."
        mode="custom"
        footer={footer}
        maxWidthClassName="max-w-md"
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Lock className="h-6 w-6" />
          </div>
          <p className="text-sm text-gray-600">
            Please request a new password reset link from the forgot password page.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/forgot-password" })}
            className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#024a23]"
          >
            Go to Forgot Password
          </button>
        </div>
      </AuthForm>
    );
  }

  return (
    <AuthForm
      title="Create New Password"
      subtitle="Your new password must be different from previous passwords."
      mode="custom"
      footer={footer}
      maxWidthClassName="max-w-md"
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-4" autoComplete="off">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-[var(--primary)]">
            <Lock className="h-6 w-6" />
          </div>
        </div>

        <PasswordField
          id="password"
          label="New Password"
          placeholder="••••••••"
          disabled={isSubmitting}
          error={errors.password?.message}
          inputProps={register("password", {
            required: "Password is required.",
            pattern: {
              value: /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
              message: "Must be 8+ chars with a number and special char.",
            },
          })}
        />

        <PasswordField
          id="confirmPassword"
          label="Confirm New Password"
          placeholder="••••••••"
          disabled={isSubmitting}
          error={errors.confirmPassword?.message}
          inputProps={register("confirmPassword", {
            required: "Please confirm your password.",
            validate: (value) => value === password || "Passwords do not match.",
          })}
        />

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#024a23] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Updating password..." : "Reset Password"}
        </button>
      </form>
    </AuthForm>
  );
}
