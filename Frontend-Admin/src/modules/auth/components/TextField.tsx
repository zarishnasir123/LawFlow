import type { UseFormRegisterReturn } from "react-hook-form";

type InputMode =
  | "none"
  | "text"
  | "tel"
  | "url"
  | "email"
  | "numeric"
  | "decimal"
  | "search";

type InputType = "text" | "email" | "tel" | "password" | "number" | "search" | "url";

type TextFieldProps = {
  id?: string;
  label: string;
  placeholder?: string;
  type?: InputType;
  autoComplete?: string;
  inputMode?: InputMode;
  disabled?: boolean;
  error?: string;
  inputProps: UseFormRegisterReturn;
};

export default function TextField({
  id,
  label,
  placeholder,
  type = "text",
  autoComplete,
  inputMode,
  disabled,
  error,
  inputProps,
}: TextFieldProps) {
  const inputId = id ?? inputProps.name;
  const inputClass = [
    "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2",
    error
      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
      : "border-gray-200 focus:border-[var(--primary)] focus:ring-green-100",
    disabled ? "cursor-not-allowed bg-gray-50 text-gray-500" : "",
  ].join(" ");

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="text-xs font-semibold text-gray-700">
        {label}
      </label>
      <input
        id={inputId}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        aria-invalid={error ? "true" : "false"}
        className={inputClass}
        {...inputProps}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
