import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { aiGuidanceLimiter } from "../../middleware/rateLimiter.js";

import {
  getSession,
  getSessions,
  patchSession,
  postLegalGuidance,
  postPolishText,
  removeSession
} from "./ai.controller.js";
import {
  aiGuidanceValidator,
  aiPolishValidator,
  sessionIdParamValidator,
  sessionUpdateValidator
} from "./ai.validators.js";

const router = Router();

// Every route is lawyer-only. The grounded system prompt, the LLM key, and the
// conversation store all live on the backend.
router.use(authenticate, authorizeRoles("lawyer"));

// Conversation sidebar: list / open / delete the caller's chats.
router.get("/sessions", asyncHandler(getSessions));

router.get(
  "/sessions/:sessionId",
  sessionIdParamValidator,
  validateRequest,
  asyncHandler(getSession)
);

router.patch(
  "/sessions/:sessionId",
  sessionUpdateValidator,
  validateRequest,
  asyncHandler(patchSession)
);

router.delete(
  "/sessions/:sessionId",
  sessionIdParamValidator,
  validateRequest,
  asyncHandler(removeSession)
);

// Ask the assistant. Rate limited because every call proxies to the LLM
// (quota/cost). Creates or continues a conversation and persists the turn.
router.post(
  "/guidance",
  aiGuidanceLimiter,
  aiGuidanceValidator,
  validateRequest,
  asyncHandler(postLegalGuidance)
);

// Polish a selected chunk of the lawyer's own document prose (grammar fix or
// formal rewrite). Stateless and rate limited (same per-IP limiter as guidance,
// since each call proxies to the LLM).
router.post(
  "/polish",
  aiGuidanceLimiter,
  aiPolishValidator,
  validateRequest,
  asyncHandler(postPolishText)
);

export default router;
