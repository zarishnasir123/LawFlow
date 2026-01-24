import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import AuthForm from "../components/AuthForm";
import LoginForm from "../components/LoginForm";
import { DEFAULT_ADMIN } from "../mock/admin.default"; // ✅ ADD

export default function Login() {
  const navigate = useNavigate();

  const footer = (
    <div className="space-y-3 text-center text-sm text-gray-600">
      <div>
        Don't have an account?{" "}
        <button
          type="button"
          onClick={() => navigate({ to: "/register" })}
          className="font-semibold text-[var(--primary)] hover:underline"
        >
          Register here
        </button>
      </div>
      <button
        type="button"
        onClick={() => navigate({ to: "/" })}
        className="inline-flex items-center justify-center gap-2 text-gray-500 hover:text-[var(--primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </button>
    </div>
  );

  // ✅ ADD: admin login handler (doesn't break anything)
  const handleAdminLogin = (email: string, password: string) => {
    if (email === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) {
      localStorage.setItem(
        "user",
        JSON.stringify({
          email: DEFAULT_ADMIN.email,
          role: DEFAULT_ADMIN.role,
          name: DEFAULT_ADMIN.name,
        })
      );
      navigate({ to: "/admin-dashboard" });
      return true; // matched
    }
    return false; // not matched
  };

  return (
    <AuthForm
      title="Welcome to LawFlow"
      subtitle="Login to access your account"
      footer={footer}
      mode="custom"
      maxWidthClassName="max-w-md"
    >
      <LoginForm
        onForgotPassword={() => navigate({ to: "/forgot-password" })}
        onAdminLogin={handleAdminLogin}  // ✅ ADD
      />
    </AuthForm>
  );
}
