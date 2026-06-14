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

// Session routes carry the conversation id in the URL.
export const sessionIdParamValidator = [
  param("sessionId").isUUID().withMessage("sessionId must be a valid UUID")
];
