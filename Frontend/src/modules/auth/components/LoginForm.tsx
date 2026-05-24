import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useLoginStore } from "../store";
import type {
  AuthResponse,
  LoginPayload,
  LoginRole,
  LoginSuccessResponse,
} from "../types";
import { authApi, getAuthErrorMessage } from "../api";
import { saveStoredAuthUser } from "../utils/authStorage";
import GoogleAuthButton from "./GoogleAuthButton";
import PasswordField from "./PasswordField";
import ReactivateAccountModal from "./ReactivateAccountModal";
import RoleSelector from "./RoleSelector";
import TextField from "./TextField";
import { loginClient } from "../../client/api";
import { loginLawyer } from "../../lawyer/api";
import { loginRegistrar } from "../../registrar/api";

// Where to send each role after a successful login. Pulled out so
// the post-login handler and the post-reactivate handler can share
// it without duplicating the switch.
const ROLE_DESTINATION: Record<LoginRole, string> = {
  client: "/client-dashboard",
  lawyer: "/Lawyer-dashboard",
  registrar: "/registrar-dashboard",
  admin: "/admin-dashboard",
};

type LoginFormProps = {
  onForgotPassword?: () => void;
};

export default function LoginForm({ onForgotPassword }: LoginFormProps) {
  const navigate = useNavigate();
  const role = useLoginStore((state) => state.role);
  const setRole = useLoginStore((state) => state.setRole);
  const setEmail = useLoginStore((state) => state.setEmail);

  // One-shot banner shown after the user completes a forced password change.
  // The flag is written by ChangeTempPassword.tsx into sessionStorage and
  // cleared here on first read so a refresh or revisit doesn't re-show it.
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("lawflow_password_change_success") === "1") {
        sessionStorage.removeItem("lawflow_password_change_success");
        setPasswordChangeSuccess(true);
      }
    } catch {
      // ignore — banner is a nicety
    }
  }, []);

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

  // Reactivation prompt state. Populated when /auth/login responds
  // with { reactivationRequired: true, reactivationToken,
  // deactivatedAt }. The token is short-lived (5min) and only
  // valid for this user — we hold it in component state until the
  // user clicks Continue or Cancel. deactivatedAt is forwarded to
  // the modal so it can show the days-remaining countdown.
  const [reactivation, setReactivation] = useState<{
    token: string;
    rememberMe: boolean;
    deactivatedAt: string;
  } | null>(null);
  const [reactivateError, setReactivateError] = useState<string | null>(null);

  // Shared post-login finalizer. Both the normal login mutations
  // and the reactivate mutation hit this once they have an
  // accessToken + user — saves auth state and navigates to the
  // right dashboard.
  const finalizeLogin = (
    data: LoginSuccessResponse,
    rememberMe: boolean
  ) => {
    const fullName = [data.user.firstName, data.user.lastName]
      .filter(Boolean)
      .join(" ");
    setEmail(data.user.email);
    saveStoredAuthUser(
      {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        name: fullName || data.user.email,
        refreshTokenExpiresAt: data.refreshTokenExpiresAt,
      },
      rememberMe,
      data.accessToken
    );
    const destination = ROLE_DESTINATION[data.user.role] || "/login";
    navigate({ to: destination });
  };

  // The three role-specific login functions now all return
  // AuthResponse (a discriminated union). This wrapper checks the
  // discriminant before finalizing — if reactivation is required
  // we don't save tokens, we open the modal instead.
  const handleLoginResponse = (
    data: AuthResponse,
    variables: LoginPayload
  ) => {
    if (data.reactivationRequired) {
      setReactivateError(null);
      setReactivation({
        token: data.reactivationToken,
        rememberMe: Boolean(variables.rememberMe),
        deactivatedAt: data.deactivatedAt,
      });
      return;
    }
    finalizeLogin(data, Boolean(variables.rememberMe));
  };

  const reactivateMutation = useMutation({
    mutationFn: authApi.reactivateAccount,
    onSuccess: (data) => {
      finalizeLogin(data, reactivation?.rememberMe ?? false);
      setReactivation(null);
      setReactivateError(null);
    },
    onError: (err) => {
      setReactivateError(getAuthErrorMessage(err));
    },
  });

  const clientLoginMutation = useMutation({
    mutationFn: loginClient,
    onSuccess: handleLoginResponse,
  });

  const lawyerLoginMutation = useMutation({
    mutationFn: loginLawyer,
    onSuccess: (data, variables) => {
      // The reactivation prompt fires before the role check — a
      // deactivated lawyer signing in from the Lawyer tab still
      // needs the choice to recover. After reactivation
      // finalizeLogin will land them on the lawyer dashboard.
      if (data.reactivationRequired) {
        handleLoginResponse(data, variables);
        return;
      }
      if (data.user.role !== "lawyer") {
        alert("These credentials do not belong to a lawyer account.");
        return;
      }
      handleLoginResponse(data, variables);
    },
  });

  const registrarLoginMutation = useMutation({
    mutationFn: loginRegistrar,
    onSuccess: (data, variables) => {
      if (data.reactivationRequired) {
        handleLoginResponse(data, variables);
        return;
      }
      if (data.user.role !== "registrar") {
        alert("These credentials do not belong to a registrar account.");
        return;
      }
      handleLoginResponse(data, variables);
    },
  });

  const disabled =
    isSubmitting ||
    clientLoginMutation.isPending ||
    lawyerLoginMutation.isPending ||
    registrarLoginMutation.isPending;

  // Wrap setRole so stale error banners from a previous role's mutation don't
  // stack when the user toggles between Client / Lawyer / Registrar tabs.
  const changeRole = (next: LoginRole) => {
    clientLoginMutation.reset();
    lawyerLoginMutation.reset();
    registrarLoginMutation.reset();
    setRole(next);
  };

  const submit = (values: LoginPayload) => {
    setEmail(values.email);
    // The "Password changed successfully" banner is a one-shot
    // notice from the change-password flow. Once the user actually
    // attempts a login (success OR failure), the notice has served
    // its purpose — keeping it stuck under an error message is
    // confusing.
    setPasswordChangeSuccess(false);

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

      case "registrar":
        registrarLoginMutation.mutate({
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
  ];

  return (
    <>
    <form onSubmit={handleSubmit(submit)} className="space-y-6" autoComplete="off">
      <RoleSelector<LoginRole>
        value={role}
        onChange={changeRole}
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

      {passwordChangeSuccess ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Password changed successfully. Please sign in with your new password.
        </div>
      ) : null}

      {clientLoginMutation.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getAuthErrorMessage(clientLoginMutation.error)}
        </div>
      ) : null}

      {lawyerLoginMutation.isError ? (
        <LawyerLoginError message={getAuthErrorMessage(lawyerLoginMutation.error)} />
      ) : null}

      {registrarLoginMutation.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getAuthErrorMessage(registrarLoginMutation.error)}
        </div>
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

    {/* Account-deactivation recovery dialog. Mounted at the
        component root so its overlay covers the whole login page.
        Token + rememberMe captured at login time so the eventual
        reactivate call preserves the user's "stay signed in"
        choice. */}
    <ReactivateAccountModal
      isOpen={Boolean(reactivation)}
      onClose={() => {
        if (reactivateMutation.isPending) return;
        setReactivation(null);
        setReactivateError(null);
      }}
      onConfirm={() => {
        if (!reactivation) return;
        reactivateMutation.mutate(reactivation.token);
      }}
      deactivatedAt={reactivation?.deactivatedAt ?? null}
      isLoading={reactivateMutation.isPending}
      errorMessage={reactivateError}
    />
    </>
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
