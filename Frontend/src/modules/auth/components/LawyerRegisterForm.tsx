import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import PasswordField from "./PasswordField";
import { registerLawyer } from "../../lawyer/api";
import { getAuthErrorMessage } from "../api";
import type { LawyerRegisterFormValues } from "../types";

export default function LawyerRegisterForm() {
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting: isFormSubmitting },
  } = useForm<LawyerRegisterFormValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      cnic: "",
      districtBar: "Gujranwala",
      barLicenseNumber: "",
      lawDegree: null,
      barLicenseCard: null,
      password: "",
      confirmPassword: "",
      agree: false,
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerLawyer,
  });

  const disabled = registerMutation.isPending || isFormSubmitting;

  const inputClass = (hasError?: boolean) =>
    [
      "w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2",
      hasError
        ? "border-red-300 focus:border-red-400 focus:ring-red-100"
        : "border-gray-200 focus:border-[var(--primary)] focus:ring-green-100",
      disabled ? "cursor-not-allowed bg-gray-50 text-gray-500" : "",
    ].join(" ");

  const submit = (values: LawyerRegisterFormValues) => {
    registerMutation.mutate({
      role: "lawyer",
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone,
      cnic: values.cnic,
      districtBar: values.districtBar,
      barLicenseNumber: values.barLicenseNumber,
      lawDegree: values.lawDegree,
      barLicenseCard: values.barLicenseCard,
      password: values.password,
    });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-800">First Name</label>
          <input
            {...register("firstName", { required: "First name is required." })}
            placeholder="Ayesha"
            autoComplete="given-name"
            disabled={disabled}
            className={inputClass(Boolean(errors.firstName))}
          />
          {errors.firstName ? (
            <p className="text-xs text-red-600">{errors.firstName.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-800">Last Name</label>
          <input
            {...register("lastName", { required: "Last name is required." })}
            placeholder="Khan"
            autoComplete="family-name"
            disabled={disabled}
            className={inputClass(Boolean(errors.lastName))}
          />
          {errors.lastName ? (
            <p className="text-xs text-red-600">{errors.lastName.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
            placeholder="lawyer@example.com"
            type="email"
            autoComplete="email"
            disabled={disabled}
            className={inputClass(Boolean(errors.email))}
          />
          {errors.email ? (
            <p className="text-xs text-red-600">{errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-800">Phone Number</label>
          <input
            {...register("phone", {
              required: "Phone number is required.",
              minLength: { value: 10, message: "Enter a valid phone number." },
            })}
            placeholder="+92 300 1234567"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            disabled={disabled}
            className={inputClass(Boolean(errors.phone))}
          />
          {errors.phone ? (
            <p className="text-xs text-red-600">{errors.phone.message}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-800">CNIC Number</label>
        <input
          {...register("cnic", {
            required: "CNIC number is required.",
            pattern: {
              value: /^\d{5}-\d{7}-\d{1}$/,
              message: "Use the format 12345-1234567-1.",
            },
          })}
          placeholder="12345-1234567-1"
          inputMode="numeric"
          disabled={disabled}
          className={inputClass(Boolean(errors.cnic))}
        />
        {errors.cnic ? (
          <p className="text-xs text-red-600">{errors.cnic.message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-800">District Bar</label>
          <select
            {...register("districtBar", { required: "District bar is required." })}
            disabled={disabled}
            className={inputClass(Boolean(errors.districtBar))}
          >
            <option value="Gujranwala">Gujranwala</option>
            <option value="Other">Other</option>
          </select>
          {errors.districtBar ? (
            <p className="text-xs text-red-600">{errors.districtBar.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-800">Bar License Number</label>
          <input
            {...register("barLicenseNumber", {
              required: "Bar license number is required.",
            })}
            placeholder="Enter your bar license number"
            disabled={disabled}
            className={inputClass(Boolean(errors.barLicenseNumber))}
          />
          {errors.barLicenseNumber ? (
            <p className="text-xs text-red-600">{errors.barLicenseNumber.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-800">Law Degree Document</label>
          <input
            {...register("lawDegree", {
              required: "Law degree document is required.",
              validate: (file: File | null) =>
                file instanceof File || "Upload a valid document.",
              setValueAs: (value: FileList | null) => value?.[0] ?? null,
            })}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            disabled={disabled}
            className={inputClass(Boolean(errors.lawDegree))}
          />
          {errors.lawDegree ? (
            <p className="text-xs text-red-600">{errors.lawDegree.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-800">Bar License Card</label>
          <input
            {...register("barLicenseCard", {
              required: "Bar license card is required.",
              validate: (file: File | null) =>
                file instanceof File || "Upload a valid document.",
              setValueAs: (value: FileList | null) => value?.[0] ?? null,
            })}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            disabled={disabled}
            className={inputClass(Boolean(errors.barLicenseCard))}
          />
          {errors.barLicenseCard ? (
            <p className="text-xs text-red-600">{errors.barLicenseCard.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PasswordField
          id="lawyer-password"
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
          id="lawyer-confirm-password"
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

      <label className="flex items-start gap-2 text-sm text-gray-600">
        <input
          {...register("agree", {
            required: "You must accept the terms to continue.",
          })}
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-gray-300"
          disabled={disabled}
        />
        I agree to the Terms of Service and Privacy Policy
      </label>
      {errors.agree ? <p className="text-xs text-red-600">{errors.agree.message}</p> : null}

      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#024a23] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
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
          Account created. Please check your email to verify your account.
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-500">or continue with</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
      >
        <span className="inline-flex h-5 w-5">
          <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.68 1.22 9.16 3.6l6.84-6.84C35.72 2.38 30.2 0 24 0 14.64 0 6.68 5.38 2.72 13.2l7.98 6.2C12.58 13.3 17.86 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.1 24.5c0-1.62-.14-3.18-.4-4.7H24v9h12.5c-.54 2.94-2.2 5.44-4.68 7.12l7.2 5.6c4.2-3.88 6.58-9.6 6.58-16.02z" />
            <path fill="#FBBC05" d="M10.7 28.4c-.5-1.5-.78-3.1-.78-4.76s.28-3.26.78-4.76l-8-6.2C1 15.88 0 19.38 0 23.64s1 7.76 2.7 10.96l8-6.2z" />
            <path fill="#34A853" d="M24 47.5c6.2 0 11.4-2.06 15.2-5.6l-7.2-5.6c-2 1.34-4.56 2.12-8 2.12-6.14 0-11.42-3.8-13.3-9.1l-8 6.2C6.68 42.62 14.64 47.5 24 47.5z" />
          </svg>
        </span>
        Continue with Google
      </button>
    </form>
  );
}
