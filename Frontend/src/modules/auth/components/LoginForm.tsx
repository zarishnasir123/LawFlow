import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { loginAdmin } from "../../admin/api";
import { loginClient } from "../../client/api";
import { loginLawyer } from "../../lawyer/api";
import { loginRegistrar } from "../../registrar/api";
import { getAuthErrorMessage } from "../api";
import { useLoginStore } from "../store";
import type { LoginPayload, LoginRole } from "../types";
import PasswordField from "./PasswordField";
import RoleSelector from "./RoleSelector";

type LoginRequest = LoginPayload & {
  role: LoginRole;
};

type LoginFormProps = {
  onForgotPassword?: () => void;
};

export default function LoginForm({ onForgotPassword }: LoginFormProps) {
  const role = useLoginStore((state) => state.role);
  const setRole = useLoginStore((state) => state.setRole);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginPayload>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async ({ role: loginRole, email, password }: LoginRequest) => {
      switch (loginRole) {
        case "client":
          return loginClient({ email, password });
        case "lawyer":
          return loginLawyer({ email, password });
        case "registrar":
          return loginRegistrar({ email, password });
        case "admin":
          return loginAdmin({ email, password });
        default:
          throw new Error("Unsupported role");
      }
    },
  });

  const disabled = loginMutation.isPending || isSubmitting;

  const submit = (values: LoginPayload) => {
    loginMutation.mutate({ role, ...values });
  };

  const inputClass = (hasError?: boolean) =>
    [
      "w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2",
      hasError
        ? "border-red-300 focus:border-red-400 focus:ring-red-100"
        : "border-gray-200 focus:border-[var(--primary)] focus:ring-green-100",
      disabled ? "cursor-not-allowed bg-gray-50 text-gray-500" : "",
    ].join(" ");

  const roleOptions: Array<{ value: LoginRole; label: string }> = [
    { value: "client", label: "Client" },
    { value: "lawyer", label: "Lawyer" },
    { value: "registrar", label: "Registrar" },
    { value: "admin", label: "Admin" },
  ];

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6" autoComplete="off">
      <RoleSelector<LoginRole>
        value={role}
        onChange={setRole}
        options={roleOptions}
        label="Login as"
      />

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-800">Email Address</label>
        <input
          {...register("email", {
            required: "Email is required.",
            pattern: {
              value: /^\S+@\S+\.\S+$/,
              message: "Enter a valid email address.",
            },
          })}
          type="email"
          placeholder="your.email@example.com"
          autoComplete="off"
          disabled={disabled}
          className={inputClass(Boolean(errors.email))}
        />
        {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
      </div>

      <PasswordField
        id="login-password"
        label="Password"
        placeholder="Enter your password"
        autoComplete="new-password"
        inputProps={register("password", { required: "Password is required." })}
        error={errors.password?.message}
        disabled={disabled}
      />

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-gray-600">
          <input type="checkbox" className="rounded border-gray-300" />
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

      {loginMutation.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getAuthErrorMessage(loginMutation.error)}
        </div>
      ) : null}
    </form>
  );
}
