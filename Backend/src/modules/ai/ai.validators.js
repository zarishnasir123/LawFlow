import { body, param } from "express-validator";

// Validates the AI guidance request. The prompt is required and length-capped
// so a single call can't push an unbounded payload at the model. `sessionId` is
// optional: present to continue an existing conversation, absent to start a new
// one. Conversation history is owned by the server (loaded from the DB), so it
// is no longer accepted from the client.
export const aiGuidanceValidator = [
  body("prompt")
    .isString()
    .withMessage("prompt must be text")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("prompt is required")
    .bail()
    .isLength({ max: 8000 })
    .withMessage("prompt must be 8000 characters or less"),

  body("sessionId")
    .optional({ nullable: true })
    .isUUID()
    .withMessage("sessionId must be a valid UUID")
];

// Validates the case-drafting request. `caseId` identifies the case to draft for
// (ownership re-checked in the service); `instruction` is the lawyer's message
// (required, capped); `history` is the optional recent conversation for multi-turn
// refinement (ephemeral — passed by the client, not stored).
export const aiDraftValidator = [
  body("caseId").isUUID().withMessage("caseId must be a valid UUID"),
  body("instruction")
    .isString()
    .withMessage("instruction must be text")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("instruction is required")
    .bail()
    .isLength({ max: 8000 })
    .withMessage("instruction must be 8000 characters or less"),
  body("mode")
    .optional()
    .isIn(["section", "full_case", "edit_selection"])
    .withMessage("mode must be 'section', 'full_case', or 'edit_selection'"),
  body("selection")
    .optional()
    .isString()
    .withMessage("selection must be text")
    .bail()
    .isLength({ max: 8000 })
    .withMessage("selection must be 8000 characters or less"),
  body("history").optional().isArray({ max: 10 }).withMessage("history must be an array"),
  body("history.*.role")
    .optional()
    .isIn(["user", "ai"])
    .withMessage("history role must be 'user' or 'ai'"),
  body("history.*.text")
    .optional()
    .isString()
    .isLength({ max: 8000 })
    .withMessage("history text must be 8000 characters or less")
];

// Session routes carry the conversation id in the URL.
export const sessionIdParamValidator = [
  param("sessionId").isUUID().withMessage("sessionId must be a valid UUID")
];

// Rename / pin a conversation. Both body fields are optional, but the service
// rejects an empty patch; title (if present) must be non-empty and capped.
export const sessionUpdateValidator = [
  param("sessionId").isUUID().withMessage("sessionId must be a valid UUID"),
  body("title")
    .optional()
    .isString()
    .withMessage("title must be text")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("title cannot be empty")
    .bail()
    .isLength({ max: 120 })
    .withMessage("title must be 120 characters or less"),
  body("pinned")
    .optional()
    .isBoolean()
    .withMessage("pinned must be a boolean")
    .toBoolean()
];
