const rateLimitMap = new Map();

/**
 * Simple in-memory rate limiter.
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds.
 * @param {number} options.max - Maximum number of requests per window.
 * @param {string} options.message - Error message to return.
 */
export const rateLimiter = ({ windowMs, max, message }) => {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    
    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, { count: 1, firstRequest: now });
      return next();
    }
    
    const record = rateLimitMap.get(key);
    
    if (now - record.firstRequest > windowMs) {
      // Reset window
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
