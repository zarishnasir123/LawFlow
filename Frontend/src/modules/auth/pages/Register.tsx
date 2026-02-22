import { useNavigate } from "@tanstack/react-router";
import AuthForm from "../components/AuthForm";

export default function Register() {
  const navigate = useNavigate();

  const footer = (
    <div className="space-y-3 text-center text-sm text-gray-600">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
        Registrar accounts are created by admin only. Registrar users should use credentials shared by admin.
      </div>
      <div>
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => navigate({ to: "/login" })}
          className="font-semibold text-[var(--primary)] hover:underline"
        >
          Log in
        </button>
      </div>
      <button
        type="button"
        onClick={() => navigate({ to: "/" })}
        className="text-gray-500 hover:text-[var(--primary)]"
      >
        Back to home
      </button>
    </div>
  );

  return (
    <AuthForm
      title="Create your account"
      subtitle="Register to get started with LawFlow"
      footer={footer}
      mode="register"
    />
  );
}
