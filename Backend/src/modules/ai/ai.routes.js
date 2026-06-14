import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { aiGuidanceLimiter } from "../../middleware/rateLimiter.js";

import {
  getSession,
  getSessions,
  postLegalGuidance,
  removeSession
} from "./ai.controller.js";
import { aiGuidanceValidator, sessionIdParamValidator } from "./ai.validators.js";

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

export default router;
