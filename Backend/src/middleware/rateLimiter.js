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
