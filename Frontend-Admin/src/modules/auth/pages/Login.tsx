import { Shield } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import AdminLoginForm from "../components/AdminLoginForm";

export default function Login() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen scroll-smooth bg-gradient-to-br from-green-50 to-white px-4 py-6 flex items-center justify-center">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl border border-green-100 bg-white p-6 shadow-[0_8px_24px_-18px_rgba(34,197,94,0.35)] sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
              <Shield className="h-5 w-5" />
            </div>

            <h1 className="text-lg font-bold text-[var(--primary)]">
              LawFlow Admin Portal
            </h1>
            <p className="mt-1 text-xs text-gray-600">
              Restricted access. Administrators only.
            </p>
          </div>

          <AdminLoginForm
            onForgotPassword={() => navigate({ to: "/forgot-password" })}
          />
        </div>
      </div>
    </div>
  );
}
