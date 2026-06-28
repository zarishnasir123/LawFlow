import { verifyAccessToken } from "../utils/tokens.js";
import { recordActivity } from "../services/activityTracker.service.js";

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    req.user = verifyAccessToken(token);
    // Best-effort daily active-user ledger (throttled, fire-and-forget; never
    // blocks or fails the request). JWT id is `sub`.
    recordActivity(req.user?.sub);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
