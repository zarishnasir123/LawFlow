import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import type { LoginPayload } from "../types";
import { getAuthErrorMessage, loginAdmin } from "../api";
import { saveStoredAuthUser } from "../utils/authStorage";
import PasswordField from "./PasswordField";
import TextField from "./TextField";

type AdminLoginFormProps = {
  onForgotPassword?: () => void;
};

export default function AdminLoginForm({ onForgotPassword }: AdminLoginFormProps) {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginPayload>({
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const adminLoginMutation = useMutation({
    mutationFn: loginAdmin,
    onSuccess: (data, variables) => {
      // Defence-in-depth: backend already enforces expectedRole, but if it
      // ever returned a non-admin user we refuse to navigate into the panel.
      if (data.user.role !== "admin") {
        alert("These credentials do not belong to an admin account.");
        return;
      }

      const fullName = [data.user.firstName, data.user.lastName]
        .filter(Boolean)
        .join(" ");

      saveStoredAuthUser(
        {
          id: data.user.id,
          email: data.user.email,
          role: data.user.role,
          name: fullName || data.user.email,
          refreshTokenExpiresAt: data.refreshTokenExpiresAt,
        },
        Boolean(variables.rememberMe),
        data.accessToken
      );

      navigate({ to: "/dashboard" });
    },
  });

  const disabled = isSubmitting || adminLoginMutation.isPending;

  const submit = (values: LoginPayload) => {
    adminLoginMutation.mutate({
      email: values.email,
      password: values.password,
      rememberMe: Boolean(values.rememberMe),
    });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6" autoComplete="off">
      <TextField
        label="Email Address"
        placeholder="admin@lawflow.pk"
        type="email"
        autoComplete="off"
        disabled={disabled}
        error={errors.email?.message}
        inputProps={register("email", {
          required: "Email is required.",
          pattern: {
            value: /^\S+@\S+\.\S+$/,
            message: "Enter a valid email address.",
          },
        })}
      />

      <PasswordField
        id="admin-login-password"
        label="Password"
        placeholder="Enter your password"
        autoComplete="new-password"
        inputProps={register("password", { required: "Password is required." })}
        error={errors.password?.message}
        disabled={disabled}
      />

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-gray-600">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            disabled={disabled}
            {...register("rememberMe")}
          />
          Remember me
        </label>

        {onForgotPassword ? (
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-[var(--primary)] hover:underline"
          >
            Forgot password?
          </button>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#024a23] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {disabled ? "Logging in..." : "Login"}
      </button>

      {adminLoginMutation.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getAuthErrorMessage(adminLoginMutation.error)}
        </div>
      ) : null}
    </form>
  );
}
