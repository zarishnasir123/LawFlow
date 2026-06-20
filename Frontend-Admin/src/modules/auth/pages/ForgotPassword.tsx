import { useState } from "react";
import { ArrowLeft, CheckCircle, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate } from "@tanstack/react-router";

import AuthShell from "../components/AuthShell";
import TextField from "../components/TextField";
import { authApi, getAuthErrorMessage } from "../api";

type ForgotPasswordValues = {
  email: string;
};

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ defaultValues: { email: "" } });

  const submit = async (values: ForgotPasswordValues) => {
    try {
      setError(null);
      await authApi.forgotPassword(values.email);
      setSubmittedEmail(values.email);
      setSubmitted(true);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    }
  };

  if (submitted) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="If an account exists, a reset link has been sent."
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-[var(--primary)]">
            <CheckCircle className="h-6 w-6" />
          </div>
          <p className="text-sm text-gray-600">
            If an account is registered with{" "}
            <span className="font-semibold text-gray-800">
              {submittedEmail || "this email"}
            </span>
            , a password reset link has been sent. Open it to set a new password.
          </p>
          <p className="text-xs text-gray-500">
            Didn't get an email? Check your spam folder, or try again in a few
            minutes.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/login" })}
            className="w-full rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#024a23]"
          >
            Back to login
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot password?"
      subtitle="Enter your admin email and we'll send a reset link."
    >
      <form
        onSubmit={handleSubmit(submit)}
        className="space-y-5"
        autoComplete="off"
      >
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-[var(--primary)]">
            <Mail className="h-6 w-6" />
          </div>
        </div>

        <TextField
          label="Email Address"
          placeholder="lawflowadmin@gmail.com"
          type="email"
          autoComplete="off"
          disabled={isSubmitting}
          error={errors.email?.message}
          inputProps={register("email", {
            required: "Email is required.",
            pattern: {
              value: /^\S+@\S+\.\S+$/,
              message: "Enter a valid email address.",
            },
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
          {isSubmitting ? "Sending..." : "Send reset link"}
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
