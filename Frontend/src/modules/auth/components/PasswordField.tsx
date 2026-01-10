import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";

type PasswordFieldProps = {
  id: string;
  label: string;
  inputProps: UseFormRegisterReturn;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  disabled?: boolean;
};

export default function PasswordField({
  id,
  label,
  inputProps,
  placeholder,
  autoComplete,
  error,
  disabled,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-gray-800">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          {...inputProps}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? "true" : "false"}
          disabled={disabled}
          className={[
            "w-full rounded-2xl border bg-white px-4 py-3 pr-11 text-sm outline-none focus:ring-2",
            error
              ? "border-red-300 focus:border-red-400 focus:ring-red-100"
              : "border-gray-200 focus:border-[var(--primary)] focus:ring-green-100",
            disabled ? "cursor-not-allowed bg-gray-50 text-gray-500" : "",
          ].join(" ")}
          required
        />

        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed"
          aria-label={show ? "Hide password" : "Show password"}
          disabled={disabled}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
