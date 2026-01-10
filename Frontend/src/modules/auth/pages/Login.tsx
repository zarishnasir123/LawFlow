import { useNavigate } from "@tanstack/react-router";
import AuthForm from "../components/AuthForm";
import LoginForm from "../components/LoginForm";

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
          Register
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
      title="Welcome to LawFlow"
      subtitle="Login to access your account"
      footer={footer}
      mode="custom"
    >
      <LoginForm />
    </AuthForm>
  );
}
