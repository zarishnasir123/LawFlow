import { query } from "express-validator";

// GET /api/lawyers — list of approved + active lawyers, optionally
// filtered by search keyword and specialization. Pagination caps
// mirror the admin endpoints in auth.validators.js so a single
// limit policy applies across the API.
export const listLawyersValidator = [
  query("search")
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage("Search must be 120 characters or less"),

  // Closed-set specialization filter. Accepts the same canonical
  // values updateMyProfileValidator allows, plus a sentinel "all" so
  // the frontend can opt out of filtering without removing the key.
  query("specialization")
    .optional()
    .trim()
    .custom((value) => {
      if (!value) return true;
      if (["all", "Civil", "Family", "civil", "family"].includes(value)) {
        return true;
      }
      throw new Error("Specialization must be Civil, Family, or all");
    }),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),

  query("offset")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Offset must be zero or a positive integer")
    .toInt(),
];
