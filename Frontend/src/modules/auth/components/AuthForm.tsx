import type { ReactNode } from "react";
import { Scale } from "lucide-react";
import ClientRegisterForm from "./ClientRegisterForm";
import LawyerRegisterForm from "./LawyerRegisterForm";
import RoleSelector from "./RoleSelector";
import type { RegisterRole } from "../types";
import { useRegisterStore } from "../store";

type AuthFormProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  mode?: "register" | "custom";
  maxWidthClassName?: string;
  cardClassName?: string;
};

export default function AuthForm({
  title,
  subtitle,
  children,
  footer,
  mode = "register",
  maxWidthClassName,
  cardClassName,
}: AuthFormProps) {
  const role = useRegisterStore((state) => state.role);
  const setRole = useRegisterStore((state) => state.setRole);

  const registerOptions: Array<{ value: RegisterRole; label: string }> = [
    { value: "client", label: "Client" },
    { value: "lawyer", label: "Lawyer" },
  ];

  const body =
    mode === "register" ? (
      <div className="space-y-6">
        <RoleSelector<RegisterRole>
          value={role}
          onChange={setRole}
          options={registerOptions}
          label="Register as"
        />
        {role === "client" ? <ClientRegisterForm /> : <LawyerRegisterForm />}
      </div>
    ) : (
      children
    );

  const containerClass =
    mode === "custom"
      ? "min-h-screen scroll-smooth bg-gradient-to-br from-green-50 to-white px-4 py-6 flex items-center justify-center"
      : "min-h-screen scroll-smooth bg-gradient-to-br from-green-50 to-white px-4 py-6";

  const mergedCardClass = [
    "rounded-3xl border border-green-100 bg-white p-4 shadow-[0_8px_24px_-18px_rgba(34,197,94,0.35)] sm:p-5",
    cardClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClass}>
      <div className={["mx-auto w-full", maxWidthClassName ?? "max-w-3xl"].join(" ")}>
        <div className={mergedCardClass}>
          {/* Header */}
          <div className="mb-4 text-center">
            <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
              <Scale className="h-5 w-5" />
            </div>

            <h1 className="text-lg font-bold text-[var(--primary)]">{title}</h1>
            {subtitle ? <p className="mt-1 text-xs text-gray-600">{subtitle}</p> : null}
          </div>

          {/* Body */}
          {body}

          {/* Footer */}
          {footer ? <div className="mt-8">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
