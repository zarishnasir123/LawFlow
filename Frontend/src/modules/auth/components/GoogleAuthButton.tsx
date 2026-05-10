type GoogleAuthButtonProps = {
  label?: string;
  disabled?: boolean;
};

function getBackendApiUrl() {
  return import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
}

export default function GoogleAuthButton({
  label = "Continue with Google",
  disabled = false,
}: GoogleAuthButtonProps) {
  const handleClick = () => {
    window.location.href = `${getBackendApiUrl()}/auth/google`;
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span className="inline-flex h-5 w-5">
        <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.68 1.22 9.16 3.6l6.84-6.84C35.72 2.38 30.2 0 24 0 14.64 0 6.68 5.38 2.72 13.2l7.98 6.2C12.58 13.3 17.86 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.1 24.5c0-1.62-.14-3.18-.4-4.7H24v9h12.5c-.54 2.94-2.2 5.44-4.68 7.12l7.2 5.6c4.2-3.88 6.58-9.6 6.58-16.02z" />
          <path fill="#FBBC05" d="M10.7 28.4c-.5-1.5-.78-3.1-.78-4.76s.28-3.26.78-4.76l-8-6.2C1 15.88 0 19.38 0 23.64s1 7.76 2.7 10.96l8-6.2z" />
          <path fill="#34A853" d="M24 47.5c6.2 0 11.4-2.06 15.2-5.6l-7.2-5.6c-2 1.34-4.56 2.12-8 2.12-6.14 0-11.42-3.8-13.3-9.1l-8 6.2C6.68 42.62 14.64 47.5 24 47.5z" />
        </svg>
      </span>
      {label}
    </button>
  );
}
