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
};

export default function AuthForm({
  title,
  subtitle,
  children,
  footer,
  mode = "register",
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

  return (
    <div className="min-h-screen scroll-smooth bg-gradient-to-br from-green-50 to-white px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-3xl border border-green-100 bg-white p-6 shadow-xl sm:p-8">
          {/* Header */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--primary)] text-white shadow-sm">
              <Scale className="h-7 w-7" />
            </div>

            <h1 className="text-2xl font-bold text-[var(--primary)]">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-gray-600">{subtitle}</p> : null}
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
