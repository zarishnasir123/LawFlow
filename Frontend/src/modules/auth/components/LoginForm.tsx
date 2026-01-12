import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useLoginStore } from "../store";
import type { LoginPayload, LoginRole } from "../types";
import PasswordField from "./PasswordField";
import RoleSelector from "./RoleSelector";
import TextField from "./TextField";

type LoginFormProps = {
  onForgotPassword?: () => void;
};

export default function LoginForm({ onForgotPassword }: LoginFormProps) {
  const navigate = useNavigate();
  const role = useLoginStore((state) => state.role);
  const setRole = useLoginStore((state) => state.setRole);
  const setEmail = useLoginStore((state) => state.setEmail);

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

  const disabled = isSubmitting;

  const submit = (values: LoginPayload) => {
    void role;
    setEmail(values.email);
    navigate({ to: "/client-dashboard" });
  };

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
        label="Select Role"
        id="login-role"
        disabled={disabled}
      />

      <TextField
        label="Email Address"
        placeholder="your.email@example.com"
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

    </form>
  );
}
