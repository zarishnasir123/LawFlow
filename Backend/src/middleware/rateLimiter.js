const rateLimitMap = new Map();

// Drop stale entries opportunistically so the map can't grow unboundedly
// across the process lifetime. We sweep at most once per minute, regardless
// of how many requests come in.
const sweepIntervalMs = 60 * 1000;
let lastSweepAt = 0;

function sweepExpired(now, windowMs) {
  if (now - lastSweepAt < sweepIntervalMs) return;
  lastSweepAt = now;
  for (const [key, record] of rateLimitMap) {
    if (now - record.firstRequest > windowMs) {
      rateLimitMap.delete(key);
    }
  }
}

export const rateLimiter = ({ windowMs, max, message }) => {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();

    sweepExpired(now, windowMs);

    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, { count: 1, firstRequest: now });
      return next();
    }

    const record = rateLimitMap.get(key);

    if (now - record.firstRequest > windowMs) {
      record.count = 1;
      record.firstRequest = now;
      return next();
    }

    if (record.count >= max) {
      return res.status(429).json({ message });
    }

    record.count += 1;
    next();
  };
};

export const forgotPasswordLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many password reset requests from this IP. Please try again after 15 minutes."
});

export const resetPasswordLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many password reset attempts from this IP. Please try again after 15 minutes."
});

// Credential-stuffing defence on top of the per-account lockout. Per-account
// lockout stops a single email from being brute-forced; this stops one IP
// from trying many emails in quick succession.
export const loginLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many login attempts from this IP. Please try again after 15 minutes."
});

// Registration sends a verification email per attempt — abusable as a spam
// vector and as an account-enumeration probe. Tighter than login.
export const registerLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many registration attempts from this IP. Please try again after 15 minutes."
});

// OTP resend triggers an email send each time. Keep tight.
export const otpResendLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many verification code requests from this IP. Please try again after 15 minutes."
});

// Admin lawyer-review endpoint is authenticated + admin-only, but the
// per-IP cap helps contain accidental client loops and any compromised
// admin token.
export const lawyerReviewLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Too many review requests. Please try again after 15 minutes."
});

// Admin-only registrar CRUD endpoints. Mirrors lawyerReviewLimiter: tight
// enough to contain runaway loops and stolen admin tokens, loose enough
// not to bother a real admin doing normal management.
export const registrarManagementLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Too many registrar management requests. Please try again after 15 minutes."
});

// Resending credentials triggers an email + password reset. The cap is a
// safety net against a stolen admin token spamming a registrar's inbox or a
// runaway client loop — set high enough that a real admin doing normal work
// (or repeated developer testing) will never trip it.
export const registrarCredentialsLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many credentials emails requested. Please try again after 15 minutes."
});
