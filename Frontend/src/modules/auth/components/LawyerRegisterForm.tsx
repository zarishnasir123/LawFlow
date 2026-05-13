import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState, type ChangeEvent } from "react";
import { useController, useForm } from "react-hook-form";
import PasswordField from "./PasswordField";
import RoleSelector from "./RoleSelector";
import TextField from "./TextField";
import { registerLawyer } from "../lawyerApi";
import { getAuthErrorMessage } from "../api";
import type { LawyerRegisterFormValues } from "../types";

const imageMimeTypes = new Set(["image/jpeg", "image/png"]);

function getSelectedFile(value: File | FileList | null | undefined) {
  if (value instanceof File) return value;
  if (value instanceof FileList) return value[0] ?? null;
  return null;
}

function isPdfFile(value: File | FileList | null | undefined) {
  const file = getSelectedFile(value);

  return file instanceof File && (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function isJpgOrPngFile(value: File | FileList | null | undefined) {
  const file = getSelectedFile(value);
  const fileName = file?.name.toLowerCase() || "";

  return file instanceof File && (
    imageMimeTypes.has(file.type) ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg") ||
    fileName.endsWith(".png")
  );
}

export default function LawyerRegisterForm() {
  const navigate = useNavigate();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting: isFormSubmitting },
  } = useForm<LawyerRegisterFormValues>({
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      cnic: "",
      specialization: "",
      districtBar: "Gujranwala",
      barLicenseNumber: "",
      lawDegree: null,
      barLicenseCardFront: null,
      barLicenseCardBack: null,
      password: "",
      confirmPassword: "",
    },
  });

  const {
    field: districtBarField,
    fieldState: districtBarState,
  } = useController({
    name: "districtBar",
    control,
    rules: { required: "District bar is required." },
  });

  const {
    field: specializationField,
    fieldState: specializationState,
  } = useController({
    name: "specialization",
    control,
    rules: { required: "Specialization is required." },
  });

  const registerMutation = useMutation({
    mutationFn: registerLawyer,
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

  const [lawDegreeName, setLawDegreeName] = useState("");
  const [barLicenseFrontName, setBarLicenseFrontName] = useState("");
  const [barLicenseBackName, setBarLicenseBackName] = useState("");

  const disabled = registerMutation.isPending || isFormSubmitting;

  const inputClass = (hasError?: boolean) =>
    [
      "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2",
      hasError
        ? "border-red-300 focus:border-red-400 focus:ring-red-100"
        : "border-gray-200 focus:border-[var(--primary)] focus:ring-green-100",
      disabled ? "cursor-not-allowed bg-gray-50 text-gray-500" : "",
    ].join(" ");

  const submit = (values: LawyerRegisterFormValues) => {
    const degreeFile = getSelectedFile(values.lawDegree);
    const licenseFrontFile = getSelectedFile(values.barLicenseCardFront);
    const licenseBackFile = getSelectedFile(values.barLicenseCardBack);

    if (!degreeFile || !licenseFrontFile || !licenseBackFile) {
      return;
    }

    registerMutation.mutate({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone,
      cnic: values.cnic,
      specialization: values.specialization as "Civil" | "Family",
      districtBar: values.districtBar,
      barLicenseNumber: values.barLicenseNumber,
      experienceYears: null,
      consultationFee: null,
      password: values.password,
      confirmPassword: values.confirmPassword,

      degreeDocument: degreeFile,
      licenseCardFrontImage: licenseFrontFile,
      licenseCardBackImage: licenseBackFile,
    });
  };

  const districtOptions = [
    { value: "Gujranwala", label: "Gujranwala" },
    { value: "Other", label: "Other" },
  ];

  const specializationOptions = [
    { value: "Civil", label: "Civil" },
    { value: "Family", label: "Family" },
  ];

  const lawDegreeRegister = register("lawDegree", {
    required: "Law degree document is required.",
    validate: (file: File | FileList | null) => isPdfFile(file) || "Upload the law degree as a PDF file.",
    setValueAs: (value: FileList | null) => value?.[0] ?? null,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      setLawDegreeName(file?.name ?? "");
    },
  });

  const barLicenseFrontRegister = register("barLicenseCardFront", {
    required: "Bar license card front picture is required.",
    validate: (file: File | FileList | null) => isJpgOrPngFile(file) || "Upload the front picture as JPG or PNG.",
    setValueAs: (value: FileList | null) => value?.[0] ?? null,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      setBarLicenseFrontName(file?.name ?? "");
    },
  });

  const barLicenseBackRegister = register("barLicenseCardBack", {
    required: "Bar license card back picture is required.",
    validate: (file: File | FileList | null) => isJpgOrPngFile(file) || "Upload the back picture as JPG or PNG.",
    setValueAs: (value: FileList | null) => value?.[0] ?? null,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      setBarLicenseBackName(file?.name ?? "");
    },
  });

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <TextField
          label="First Name"
          placeholder="Ayesha"
          autoComplete="given-name"
          disabled={disabled}
          error={errors.firstName?.message}
          inputProps={register("firstName", { required: "First name is required." })}
        />

        <TextField
          label="Last Name"
          placeholder="Khan"
          autoComplete="family-name"
          disabled={disabled}
          error={errors.lastName?.message}
          inputProps={register("lastName", { required: "Last name is required." })}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <TextField
          label="Email Address"
          placeholder="lawyer@example.com"
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
          placeholder="+92 300 1234567"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          disabled={disabled}
          error={errors.phone?.message}
          inputProps={register("phone", {
            required: "Phone number is required.",
            minLength: { value: 10, message: "Enter a valid phone number." },
          })}
        />
      </div>

      <TextField
        label="CNIC Number"
        placeholder="12345-1234567-1"
        inputMode="numeric"
        disabled={disabled}
        error={errors.cnic?.message}
        inputProps={register("cnic", {
          required: "CNIC number is required.",
          pattern: {
            value: /^\d{5}-\d{7}-\d{1}$/,
            message: "Use the format 12345-1234567-1.",
          },
        })}
      />

      <div className="grid gap-2 sm:grid-cols-3">
        <RoleSelector
          value={specializationField.value}
          onChange={specializationField.onChange}
          options={specializationOptions}
          label="Specialization"
          id="specialization"
          placeholder="Select specialization"
          disabled={disabled}
          error={specializationState.error?.message}
        />

        <RoleSelector
          value={districtBarField.value}
          onChange={districtBarField.onChange}
          options={districtOptions}
          label="District Bar"
          id="district-bar"
          placeholder="Select district"
          disabled={disabled}
          error={districtBarState.error?.message}
        />

        <TextField
          label="Bar License Number"
          placeholder="Enter your bar license number"
          disabled={disabled}
          error={errors.barLicenseNumber?.message}
          inputProps={register("barLicenseNumber", {
            required: "Bar license number is required.",
          })}
        />
      </div>

      <div className="grid gap-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-700">Law Degree Document</label>
          <input
            id="law-degree-file"
            type="file"
            accept="application/pdf,.pdf"
            disabled={disabled}
            className="sr-only"
            {...lawDegreeRegister}
          />
          <label
            htmlFor="law-degree-file"
            className={[
              inputClass(Boolean(errors.lawDegree)),
              "flex cursor-pointer items-center justify-between gap-2 text-gray-600",
            ].join(" ")}
          >
            <span className="truncate">
              {lawDegreeName || "Upload law degree document"}
            </span>
            <span className="text-xs font-semibold text-[var(--primary)]">Browse</span>
          </label>
          {errors.lawDegree ? (
            <p className="text-xs text-red-600">{errors.lawDegree.message}</p>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Bar License Card Front</label>
            <input
              id="bar-license-front-file"
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              disabled={disabled}
              className="sr-only"
              {...barLicenseFrontRegister}
            />
            <label
              htmlFor="bar-license-front-file"
              className={[
                inputClass(Boolean(errors.barLicenseCardFront)),
                "flex cursor-pointer items-center justify-between gap-2 text-gray-600",
              ].join(" ")}
            >
              <span className="truncate">
                {barLicenseFrontName || "Upload front picture"}
              </span>
              <span className="text-xs font-semibold text-[var(--primary)]">Browse</span>
            </label>
            {errors.barLicenseCardFront ? (
              <p className="text-xs text-red-600">{errors.barLicenseCardFront.message}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Bar License Card Back</label>
            <input
              id="bar-license-back-file"
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              disabled={disabled}
              className="sr-only"
              {...barLicenseBackRegister}
            />
            <label
              htmlFor="bar-license-back-file"
              className={[
                inputClass(Boolean(errors.barLicenseCardBack)),
                "flex cursor-pointer items-center justify-between gap-2 text-gray-600",
              ].join(" ")}
            >
              <span className="truncate">
                {barLicenseBackName || "Upload back picture"}
              </span>
              <span className="text-xs font-semibold text-[var(--primary)]">Browse</span>
            </label>
            {errors.barLicenseCardBack ? (
              <p className="text-xs text-red-600">{errors.barLicenseCardBack.message}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
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
          Account created. Please check your email to verify your account.
        </div>
      ) : null}
    </form>
  );
}
