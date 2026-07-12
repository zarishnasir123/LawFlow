import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import CnicInput from "../../../shared/components/CnicInput";
import { isAllowedGujranwalaCnic } from "../../../shared/utils/pkFormat";

// CNIC field for the register forms. Wraps the skeleton-mask CnicInput in a
// react-hook-form Controller so the same label/error chrome as TextField is
// reused, and bakes in the standard CNIC rules (format + Gujranwala region gate)
// both register forms share. The stored value is the clean "XXXXX-XXXXXXX-X".
type CnicFieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  disabled?: boolean;
  error?: string;
};

export default function CnicField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  disabled,
  error,
}: CnicFieldProps<TFieldValues>) {
  const fieldId = String(name);
  const errorId = `${fieldId}-error`;
  const inputClass = [
    "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2",
    error
      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
      : "border-gray-200 focus:border-[var(--primary)] focus:ring-green-100",
    disabled ? "cursor-not-allowed bg-gray-50 text-gray-500" : "",
  ].join(" ");

  return (
    <div className="space-y-1">
      <label htmlFor={fieldId} className="text-xs font-semibold text-gray-700">
        {label}
      </label>
      <Controller
        control={control}
        name={name}
        rules={{
          required: "CNIC number is required.",
          pattern: {
            value: /^\d{5}-\d{7}-\d{1}$/,
            message: "Use the format 12345-1234567-1.",
          },
          validate: (v) =>
            isAllowedGujranwalaCnic(String(v ?? "")) ||
            "Invalid region — LawFlow is available only to Gujranwala residents.",
        }}
        render={({ field }) => (
          <CnicInput
            id={fieldId}
            name={field.name}
            value={String(field.value ?? "")}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled}
            className={inputClass}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? errorId : undefined}
          />
        )}
      />
      {error ? (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
