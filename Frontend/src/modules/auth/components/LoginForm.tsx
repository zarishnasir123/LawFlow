import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useLoginStore } from "../store";
import type { LoginPayload, LoginRole } from "../types";
import { getAuthErrorMessage } from "../api";
import { saveStoredAuthUser } from "../utils/authStorage";
import GoogleAuthButton from "./GoogleAuthButton";
import PasswordField from "./PasswordField";
import RoleSelector from "./RoleSelector";
import TextField from "./TextField";
import { useRegistrarAccountsStore } from "../../admin/store/registrars.store";
import { loginAdmin } from "../../admin/api";
import { loginClient } from "../../client/api";
import { loginLawyer } from "../../lawyer/api";

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
      rememberMe: false,
    },
  });

  const clientLoginMutation = useMutation({
    mutationFn: loginClient,
    onSuccess: (data, variables) => {
      const fullName = [data.user.firstName, data.user.lastName].filter(Boolean).join(" ");

      setEmail(data.user.email);
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
      navigate({ to: "/client-dashboard" });
    },
  });

  const adminLoginMutation = useMutation({
    mutationFn: loginAdmin,
    onSuccess: (data, variables) => {
      if (data.user.role !== "admin") {
        alert("These credentials do not belong to an admin account.");
        return;
      }

      const fullName = [data.user.firstName, data.user.lastName].filter(Boolean).join(" ");

      setEmail(data.user.email);
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
      navigate({ to: "/admin-dashboard" });
    },
  });

  const lawyerLoginMutation = useMutation({
    mutationFn: loginLawyer,
    onSuccess: (data, variables) => {
      if (data.user.role !== "lawyer") {
        alert("These credentials do not belong to a lawyer account.");
        return;
      }

      const fullName = [data.user.firstName, data.user.lastName].filter(Boolean).join(" ");

      setEmail(data.user.email);
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
      navigate({ to: "/Lawyer-dashboard" });
    },
  });

  const disabled =
    isSubmitting ||
    clientLoginMutation.isPending ||
    adminLoginMutation.isPending ||
    lawyerLoginMutation.isPending;

  const submit = (values: LoginPayload) => {
    setEmail(values.email);

    switch (role) {
      case "client":
        clientLoginMutation.mutate({
          email: values.email,
          password: values.password,
          rememberMe: Boolean(values.rememberMe),
        });
        break;

      case "lawyer":
        lawyerLoginMutation.mutate({
          email: values.email,
          password: values.password,
          rememberMe: Boolean(values.rememberMe),
        });
        break;

      case "registrar": {
        const registrar = useRegistrarAccountsStore
          .getState()
          .authenticateRegistrar(values.email, values.password);

        if (!registrar) {
          alert("Invalid registrar credentials. Contact admin for account access.");
          return;
        }

        localStorage.setItem(
          "user",
          JSON.stringify({
            email: registrar.email,
            role: "registrar",
            name: registrar.name,
          })
        );

        navigate({ to: "/registrar-dashboard" });
        break;
      }

      case "admin":
        adminLoginMutation.mutate({
          email: values.email,
          password: values.password,
          rememberMe: Boolean(values.rememberMe),
        });
        break;

      default:
        navigate({ to: "/login" });
    }
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

      {clientLoginMutation.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getAuthErrorMessage(clientLoginMutation.error)}
        </div>
      ) : null}

      {adminLoginMutation.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getAuthErrorMessage(adminLoginMutation.error)}
        </div>
      ) : null}

      {lawyerLoginMutation.isError ? (
        <LawyerLoginError message={getAuthErrorMessage(lawyerLoginMutation.error)} />
      ) : null}

      {role === "client" ? (
        <>
          <div className="flex items-center gap-1.5">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-500">or continue with</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <GoogleAuthButton disabled={disabled} />
        </>
      ) : null}
    </form>
  );
}

function LawyerLoginError({ message }: { message: string }) {
  const showRegisterLink =
    message.includes("returned by admin") || message.includes("Register again");

  return (
    <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <p>{message}</p>
      {showRegisterLink ? (
        <Link
          to="/register"
          className="inline-block font-semibold text-[var(--primary)] hover:underline"
        >
          Register again with updated documents
        </Link>
      ) : null}
    </div>
  );
}
