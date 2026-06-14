import { body } from "express-validator";

// Validates the AI guidance request. The prompt is required and length-capped
// so a single call can't push an unbounded payload at Gemini. History is
// optional prior turns the frontend forwards for conversational context; we
// validate shape leniently and the service trims it to the last N messages.
export const aiGuidanceValidator = [
  body("prompt")
    .isString()
    .withMessage("prompt must be text")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("prompt is required")
    .bail()
    .isLength({ max: 400 })
    .withMessage("prompt must be 400 characters or less"),

  body("history")
    .optional()
    .isArray({ max: 50 })
    .withMessage("history must be an array"),
  body("history.*.role")
    .optional()
    .isIn(["ai", "user"])
    .withMessage("history role must be 'ai' or 'user'"),
  body("history.*.text")
    .optional()
    .isString()
    .withMessage("history text must be text")
    .isLength({ max: 400 })
    .withMessage("history text must be 400 characters or less")
];
