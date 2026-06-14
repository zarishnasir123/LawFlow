import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { aiGuidanceLimiter } from "../../middleware/rateLimiter.js";

import { postLegalGuidance } from "./ai.controller.js";
import { aiGuidanceValidator } from "./ai.validators.js";

const router = Router();

// Lawyer-only legal assistant. Authenticated + role-gated, then per-IP rate
// limited because every call proxies to Gemini (quota/cost). The grounded
// system prompt and Gemini key live entirely on the backend.
router.post(
  "/guidance",
  authenticate,
  authorizeRoles("lawyer"),
  aiGuidanceLimiter,
  aiGuidanceValidator,
  validateRequest,
  asyncHandler(postLegalGuidance)
);

export default router;
