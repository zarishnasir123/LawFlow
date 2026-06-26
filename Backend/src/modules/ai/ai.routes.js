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
  postDraft,
  postLegalGuidance,
  removeSession
} from "./ai.controller.js";
import {
  aiDraftValidator,
  aiGuidanceValidator,
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

// Case-drafting helper for the document-editor AI panel. Same rate limit (every
// call proxies to the LLM). Verifies case ownership + editability in the handler.
router.post(
  "/draft",
  aiGuidanceLimiter,
  aiDraftValidator,
  validateRequest,
  asyncHandler(postDraft)
);

export default router;
