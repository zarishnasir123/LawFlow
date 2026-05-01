import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { MailCheck, RefreshCw } from "lucide-react";
import AuthForm from "../components/AuthForm";
import { getAuthErrorMessage } from "../api";
import { sendClientEmailVerification, verifyClientEmail } from "../../client/api";

const otpLength = 6;
const otpCountdownSeconds = 60;
const pendingEmailStorageKey = "lawflow_pending_verification_email";
const pendingOtpExpiresAtStorageKey = "lawflow_pending_verification_expires_at";

function getStoredEmail() {
  return sessionStorage.getItem(pendingEmailStorageKey) ?? "";
}

function getStoredOtpExpiresAt() {
  return sessionStorage.getItem(pendingOtpExpiresAtStorageKey) ?? "";
}

function getSecondsUntil(expiresAt: string) {
  if (!expiresAt) {
    return 0;
  }

  const expiryTime = new Date(expiresAt).getTime();

  if (Number.isNaN(expiryTime)) {
    return 0;
  }

  return Math.max(0, Math.ceil((expiryTime - Date.now()) / 1000));
}

function normalizeOtpExpiresAt(expiresAt: string) {
  const secondsUntilExpiry = getSecondsUntil(expiresAt);

  if (secondsUntilExpiry > otpCountdownSeconds) {
    return new Date(Date.now() + otpCountdownSeconds * 1000).toISOString();
  }

  return expiresAt;
}

function getInitialOtpExpiresAt() {
  const storedExpiresAt = getStoredOtpExpiresAt();
  const normalizedExpiresAt = normalizeOtpExpiresAt(storedExpiresAt);

  if (normalizedExpiresAt && normalizedExpiresAt !== storedExpiresAt) {
    sessionStorage.setItem(pendingOtpExpiresAtStorageKey, normalizedExpiresAt);
  }

  return normalizedExpiresAt;
}

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(getStoredEmail);
  const [otpExpiresAt, setOtpExpiresAt] = useState(getInitialOtpExpiresAt);
  const [secondsRemaining, setSecondsRemaining] = useState(() => (
    getSecondsUntil(getInitialOtpExpiresAt())
  ));
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(otpLength).fill(""));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const otp = useMemo(() => otpDigits.join(""), [otpDigits]);
  const otpExpired = Boolean(otpExpiresAt) && secondsRemaining === 0;

  const verifyMutation = useMutation({
    mutationFn: verifyClientEmail,
    onSuccess: () => {
      sessionStorage.removeItem(pendingEmailStorageKey);
      sessionStorage.removeItem(pendingOtpExpiresAtStorageKey);
      void navigate({ to: "/login", replace: true });
    },
  });

  const resendMutation = useMutation({
    mutationFn: sendClientEmailVerification,
    onSuccess: (data) => {
      const nextExpiresAt = normalizeOtpExpiresAt(data.verification?.expiresAt ?? "");

      setOtpDigits(Array(otpLength).fill(""));
      setOtpExpiresAt(nextExpiresAt);
      sessionStorage.setItem(pendingEmailStorageKey, email);

      if (nextExpiresAt) {
        sessionStorage.setItem(pendingOtpExpiresAtStorageKey, nextExpiresAt);
      } else {
        sessionStorage.removeItem(pendingOtpExpiresAtStorageKey);
      }

      inputRefs.current[0]?.focus();
    },
  });

  const disabled = verifyMutation.isPending || resendMutation.isPending;

  useEffect(() => {
    const updateTimer = () => {
      setSecondsRemaining(getSecondsUntil(otpExpiresAt));
    };

    updateTimer();

    if (!otpExpiresAt) {
      return undefined;
    }

    const intervalId = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(intervalId);
  }, [otpExpiresAt]);

  const setDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);

    setOtpDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });

    if (digit && index < otpLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, otpLength).split("");

    if (digits.length === 0) {
      return;
    }

    setOtpDigits(Array.from({ length: otpLength }, (_, index) => digits[index] ?? ""));

    const nextIndex = Math.min(digits.length, otpLength - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleKeyDown = (index: number, key: string) => {
    if (key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    verifyMutation.mutate({
      email,
      otp,
    });
  };

  const resendOtp = () => {
    resendMutation.mutate({ email });
  };

  return (
    <AuthForm
      title="Verify your email"
      subtitle="Enter the 6-digit code sent to your email"
      mode="custom"
      maxWidthClassName="max-w-xl"
      footer={
        <div className="text-center text-sm text-gray-600">
          <button
            type="button"
            onClick={() => navigate({ to: "/register" })}
            className="font-semibold text-[var(--primary)] hover:underline"
          >
            Back to registration
          </button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-green-50 text-[var(--primary)]">
          <MailCheck className="h-5 w-5" />
        </div>

        <div className="space-y-1">
          <label htmlFor="verification-email" className="text-xs font-semibold text-gray-700">
            Email Address
          </label>
          <input
            id="verification-email"
            name="email"
            value={email}
            type="email"
            placeholder="your.email@gmail.com"
            autoComplete="email"
            disabled={disabled}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-green-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
          />
          {!email ? <p className="text-xs text-red-600">Email is required.</p> : null}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700">Verification Code</label>
          <div className="grid grid-cols-6 gap-2">
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                value={digit}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                disabled={disabled || otpExpired}
                aria-label={`OTP digit ${index + 1}`}
                onChange={(event) => setDigit(index, event.target.value)}
                onPaste={(event) => {
                  event.preventDefault();
                  handlePaste(event.clipboardData.getData("text"));
                }}
                onKeyDown={(event) => handleKeyDown(index, event.key)}
                className="aspect-square w-full rounded-lg border border-gray-200 text-center text-lg font-semibold outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-green-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
              />
            ))}
          </div>
          <div
            className={`rounded-lg border px-3 py-2 text-center text-sm font-medium ${
              otpExpired
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-100 bg-green-50 text-[var(--primary)]"
            }`}
          >
            {otpExpiresAt ? (
              otpExpired
                ? "OTP expired. Please resend the code."
                : `OTP expires in ${secondsRemaining} seconds`
            ) : (
              `Resend code to start a fresh ${otpCountdownSeconds}-second timer.`
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={disabled || otpExpired || !email || otp.length !== otpLength}
          className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#024a23] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {verifyMutation.isPending ? "Verifying..." : "Verify Email"}
        </button>

        <button
          type="button"
          onClick={resendOtp}
          disabled={disabled || !email}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <RefreshCw className="h-4 w-4" />
          {resendMutation.isPending ? "Sending..." : "Resend Code"}
        </button>

        {verifyMutation.isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {getAuthErrorMessage(verifyMutation.error)}
          </div>
        ) : null}

        {resendMutation.isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {getAuthErrorMessage(resendMutation.error)}
          </div>
        ) : null}

        {resendMutation.isSuccess ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {resendMutation.data.message}
            {resendMutation.data.verification?.deliveryMode === "console" ? (
              <span className="mt-1 block text-xs text-green-800">
                Development mode: copy the OTP from the backend terminal.
              </span>
            ) : null}
          </div>
        ) : null}
      </form>
    </AuthForm>
  );
}
