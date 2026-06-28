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

// Validates the AI Language Polish request. `mode` selects the prompt;
// `text` is the lawyer's selected prose. We deliberately do NOT .trim() `text`
// (the service re-attaches the selection's edge whitespace), but reject a
// whitespace-only selection, and cap the length to keep each call fast/cheap.
export const aiPolishValidator = [
  body("mode")
    .isString()
    .withMessage("mode must be text")
    .bail()
    .trim()
    .isIn(["grammar", "formal"])
    .withMessage("mode must be 'grammar' or 'formal'"),

  body("text")
    .isString()
    .withMessage("text must be text")
    .bail()
    .custom((value) => value.trim().length > 0)
    .withMessage("text is required")
    .bail()
    .isLength({ max: 4000 })
    .withMessage("text must be 4000 characters or less")
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
