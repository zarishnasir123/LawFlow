import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import GoogleAuthButton from "./GoogleAuthButton";
import PasswordField from "./PasswordField";
import TextField from "./TextField";
import CnicField from "./CnicField";
import { formatPkPhone } from "../../../shared/utils/pkFormat";
import { registerClient } from "../../client/api";
import { getAuthErrorMessage } from "../api";
import type { ClientRegisterFormValues } from "../types";

export default function ClientRegisterForm() {
  const navigate = useNavigate();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting: isFormSubmitting },
  } = useForm<ClientRegisterFormValues>({
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "+92-",
      cnic: "",
      password: "",
      confirmPassword: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerClient,
    onSuccess: (data) => {
      sessionStorage.setItem("lawflow_pending_verification_email", data.user.email);
      if (data.verification?.expiresAt) {
        sessionStorage.setItem(
          "lawflow_pending_verification_expires_at",
          data.verification.expiresAt
        );
      }
      navigate({ to: "/verify-email" });
    },
  });

  const disabled = registerMutation.isPending || isFormSubmitting;

  const submit = (values: ClientRegisterFormValues) => {
    registerMutation.mutate({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone,
      cnic: values.cnic,
      password: values.password,
      confirmPassword: values.confirmPassword,
    });
  };
   
  return ( 
    <form onSubmit={handleSubmit(submit)} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <TextField
          label="First Name"
          placeholder="Zarish"
          autoComplete="given-name"
          disabled={disabled}
          error={errors.firstName?.message}
          inputProps={register("firstName", { required: "First name is required." })}
        />

        <TextField
          label="Last Name"
          placeholder="Nasir"
          autoComplete="family-name"
          disabled={disabled}
          error={errors.lastName?.message}
          inputProps={register("lastName", { required: "Last name is required." })}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <TextField
          label="Email Address"
          placeholder="your.email@gmail.com"
          type="email"
          autoComplete="email"
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

        <TextField
          label="Phone Number"
          placeholder="+92-300-1234567"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          disabled={disabled}
          error={errors.phone?.message}
          format={formatPkPhone}
          inputProps={register("phone", {
            required: "Phone number is required.",
            validate: (v) =>
              /^\+92-\d{3}-\d{7}$/.test(v) ||
              "Enter a valid Pakistani mobile number.",
          })}
        />
      </div>

      <CnicField
        control={control}
        name="cnic"
        label="CNIC Number"
        disabled={disabled}
        error={errors.cnic?.message}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <PasswordField
          id="client-password"
          label="Password"
          placeholder="Create a strong password"
          autoComplete="new-password"
          inputProps={register("password", {
            required: "Password is required.",
            minLength: { value: 8, message: "Use at least 8 characters." },
            validate: (value: string) => {
              if (!/[0-9]/.test(value)) return "Include at least one number.";
              if (!/[^A-Za-z0-9]/.test(value)) {
                return "Include at least one special character.";
              }
              return true;
            },
          })}
          error={errors.password?.message}
          disabled={disabled}
        />
        <PasswordField
          id="client-confirm-password"
          label="Confirm Password"
          placeholder="Re-enter your password"
          autoComplete="new-password"
          inputProps={register("confirmPassword", {
            required: "Confirm your password.",
            validate: (value: string) =>
              value === getValues("password") || "Passwords do not match.",
          })}
          error={errors.confirmPassword?.message}
          disabled={disabled}
        />
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#024a23] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {disabled ? "Registering..." : "Register"}
      </button>

      {registerMutation.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getAuthErrorMessage(registerMutation.error)}
        </div>
      ) : null}

      {registerMutation.isSuccess ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {registerMutation.data.message}
          {registerMutation.data.verification?.deliveryMode === "console" ? (
            <span className="mt-1 block text-xs text-green-800">
              Development mode: copy the OTP from the backend terminal.
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-1.5">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-500">or continue with</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <GoogleAuthButton disabled={disabled} />
    </form>
  );
}
