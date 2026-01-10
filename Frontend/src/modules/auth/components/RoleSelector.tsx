import { useEffect, useRef, useState } from "react";
import type { RegisterRole } from "../types";

type RoleOption<T extends string> = {
  value: T;
  label: string;
};

type RoleSelectorProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options?: Array<RoleOption<T>>;
  label?: string;
  id?: string;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
};

const defaultRegisterOptions: Array<RoleOption<RegisterRole>> = [
  { value: "client", label: "Client" },
  { value: "lawyer", label: "Lawyer" },
];

export default function RoleSelector<T extends string>({
  value,
  onChange,
  options,
  label = "Select role",
  id,
  disabled,
  error,
  placeholder,
}: RoleSelectorProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resolvedOptions =
    options ?? (defaultRegisterOptions as Array<RoleOption<T>>);

  const selectedLabel =
    resolvedOptions.find((option) => option.value === value)?.label ??
    placeholder ??
    "Select";

  const elementId = id ?? "role-selector";

  const buttonClass = [
    "flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2",
    error
      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
      : "border-gray-200 focus:border-[var(--primary)] focus:ring-green-100",
    disabled ? "cursor-not-allowed bg-gray-50 text-gray-500" : "",
  ].join(" ");

  return (
    <div className="space-y-1">
      <label htmlFor={elementId} className="text-xs font-semibold text-gray-700">
        {label}
      </label>

      <div className="relative" ref={containerRef}>
        <button
          id={elementId}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => {
            if (!disabled) {
              setIsOpen((open) => !open);
            }
          }}
          disabled={disabled}
          className={buttonClass}
        >
          <span>{selectedLabel}</span>
          <span className="text-gray-500">
            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              <path
                d="M7 10l5 5 5-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>

        {isOpen ? (
          <div
            role="listbox"
            className="absolute z-20 mt-2 w-full rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
          >
            {resolvedOptions.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={[
                    "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition",
                    isSelected
                      ? "bg-green-100/60 text-[var(--primary)]"
                      : "text-gray-700",
                  ].join(" ")}
                >
                  <span>{option.label}</span>
                  {isSelected ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path
                        d="M5 13l4 4L19 7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
