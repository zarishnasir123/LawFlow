import { useState } from "react";
import { CheckCircle, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate } from "@tanstack/react-router";
import AuthForm from "../components/AuthForm";
import TextField from "../components/TextField";

type ForgotPasswordValues = {
  email: string;
};

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    defaultValues: { email: "" },
  });

  const submit = () => {
    setSubmitted(true);
  };

  const footer = (
    <div className="space-y-3 text-center text-sm text-gray-600">
      <div>
        Remember your password?{" "}
        <button
          type="button"
          onClick={() => navigate({ to: "/login" })}
          className="font-semibold text-[var(--primary)] hover:underline"
        >
          Log in
        </button>
      </div>
      <button
        type="button"
        onClick={() => navigate({ to: "/" })}
        className="text-gray-500 hover:text-[var(--primary)]"
      >
        Back to home
      </button>
    </div>
  );

  if (submitted) {
    return (
    <AuthForm
      title="Check your email"
      subtitle="We sent a reset link if the email exists in our system."
      mode="custom"
      footer={footer}
      maxWidthClassName="max-w-md"
    >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-[var(--primary)]">
            <CheckCircle className="h-6 w-6" />
          </div>
          <p className="text-sm text-gray-600">
            Follow the link to reset your password.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/login" })}
            className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#024a23]"
          >
            Back to login
          </button>
        </div>
      </AuthForm>
    );
  }

  return (
    <AuthForm
      title="Forgot Password?"
      subtitle="Enter your email address and we will send a reset link."
      mode="custom"
      footer={footer}
      maxWidthClassName="max-w-md"
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-4" autoComplete="off">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-[var(--primary)]">
            <Mail className="h-6 w-6" />
          </div>
        </div>

        <TextField
          label="Email Address"
          placeholder="your.email@example.com"
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#024a23] disabled:cursor-not-allowed disabled:opacity-70"
        >
          Send reset link
        </button>
      </form>
    </AuthForm>
  );
}
