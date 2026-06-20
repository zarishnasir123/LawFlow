import { body, param } from "express-validator";

// Conversation id is a UUID. Reject obvious garbage at the edge; the
// user-scoped participant check in the service is still the authoritative gate
// (it 404s on any conversation the caller isn't part of).
export const conversationIdParamValidator = [
  param("conversationId")
    .isUUID()
    .withMessage("conversationId must be a valid UUID"),
];

// POST /conversations — start/reopen a chat with a lawyer.
export const startConversationValidator = [
  body("lawyerUserId").isUUID().withMessage("lawyerUserId must be a valid UUID"),
];

// POST a text message: non-empty body, capped so one message can't dump
// megabytes of text into the column. Optional replyToMessageId (a UUID).
export const sendMessageValidator = [
  param("conversationId")
    .isUUID()
    .withMessage("conversationId must be a valid UUID"),
  body("text")
    .isString()
    .withMessage("text must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Message text is required")
    .bail()
    .isLength({ max: 5000 })
    .withMessage("Message is too long (5000 characters max)"),
  body("replyToMessageId")
    .optional({ nullable: true })
    .isUUID()
    .withMessage("replyToMessageId must be a valid UUID"),
];
