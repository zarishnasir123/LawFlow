import { useEffect, useRef, useState } from "react";
import type { RegisterRole } from "../types";

type RoleSelectorProps = {
  value: RegisterRole;
  onChange: (value: RegisterRole) => void;
};

export default function RoleSelector({ value, onChange }: RoleSelectorProps) {
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

  const options: Array<{ value: RegisterRole; label: string }> = [
    { value: "client", label: "Client" },
    { value: "lawyer", label: "Lawyer" },
  ];

  const selectedLabel = options.find((option) => option.value === value)?.label ?? "Select";

  return (
    <div className="space-y-2">
      <label htmlFor="register-role" className="text-sm font-medium text-gray-800">
        Register as
      </label>

      <div className="relative" ref={containerRef}>
        <button
          id="register-role"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-green-100"
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
            className="absolute z-20 mt-2 w-full rounded-2xl border border-gray-200 bg-white p-1 shadow-lg"
          >
            {options.map((option) => {
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
                    "flex w-full items-center justify-between rounded-xl px-4 py-2 text-left text-sm transition",
                    isSelected
                      ? "bg-green-100/70 text-[var(--primary)]"
                      : "text-gray-700 hover:bg-green-100/60",
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
    </div>
  );
}
