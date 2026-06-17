import { body, param, query } from "express-validator";

import { ADMIN_CASE_STATUSES } from "./adminCases.service.js";
import { PAYOUT_STATUSES } from "../payments/payouts.service.js";

// Validators for the admin case-traceability endpoints. Mirrors the
// registrarReview.validators.js conventions: a malformed value surfaces as
// a clean 400 (via validateRequest) instead of falling through to a
// Postgres error or silently returning wrong data.

// GET /api/admin/cases/:caseId — the case id must be a UUID, else the DB
// lookup would 500 on a bad cast. Caught here as a 400 first.
export const adminCaseIdParamValidator = [
  param("caseId").isUUID().withMessage("caseId must be a valid UUID")
];

// GET /api/admin/cases — list filters are all OPTIONAL:
//   * status : if present, must be one of the four lifecycle statuses
//              (single source of truth: ADMIN_CASE_STATUSES). Anything
//              else is a clean 400 rather than an empty result.
//   * search : free text; only type-checked (a string). Trimming and the
//              ILIKE wildcarding happen in the service.
//   * limit  : 1..100 integer; the service still clamps defensively, so
//              this just rejects obviously bad input early.
//   * offset : non-negative integer; service floors at 0 as well.
export const listAdminCasesValidator = [
  query("status")
    .optional()
    .isIn(ADMIN_CASE_STATUSES)
    .withMessage(`status must be one of: ${ADMIN_CASE_STATUSES.join(", ")}`),
  query("search")
    .optional()
    .isString()
    .withMessage("search must be text"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be an integer between 1 and 100"),
  query("offset")
    .optional()
    .isInt({ min: 0 })
    .withMessage("offset must be a non-negative integer")
];

// The statuses an admin sets via the generic PATCH. "paid" is excluded — it
// goes through the dedicated mark-paid endpoint that also captures transfer
// proof; "requested" is the lawyer's starting state, never admin-set.
const PAYOUT_PATCH_STATUSES = ["processing", "failed", "cancelled"];

// GET /api/admin/payouts — optional status filter (any real payout status).
export const listPayoutsValidator = [
  query("status")
    .optional()
    .isIn(PAYOUT_STATUSES)
    .withMessage(`status must be one of: ${PAYOUT_STATUSES.join(", ")}`)
];

// PATCH /api/admin/payouts/:payoutId — processing | failed | cancelled, with an
// optional note. Marking paid is NOT allowed here (use mark-paid).
export const updatePayoutValidator = [
  param("payoutId").isUUID().withMessage("payoutId must be a valid UUID"),
  body("status")
    .isIn(PAYOUT_PATCH_STATUSES)
    .withMessage(`status must be one of: ${PAYOUT_PATCH_STATUSES.join(", ")}`),
  body("note")
    .optional({ nullable: true })
    .isString()
    .withMessage("note must be text")
    .isLength({ max: 2000 })
    .withMessage("note is too long")
];

// PUT /api/admin/commission-rate — the platform fee percentage (0–100).
export const updateCommissionRateValidator = [
  body("commissionRate")
    .exists()
    .withMessage("commissionRate is required")
    .bail()
    .isFloat({ min: 0, max: 100 })
    .withMessage("commissionRate must be a number between 0 and 100")
];

// POST /api/admin/payouts/:payoutId/mark-paid (multipart) — proof of transfer.
// reference + transfer date + sending bank are required; the receipt file is
// checked in the handler (express-validator can't see multipart files).
export const markPayoutPaidValidator = [
  param("payoutId").isUUID().withMessage("payoutId must be a valid UUID"),
  body("reference")
    .trim()
    .notEmpty()
    .withMessage("A bank reference / transaction ID is required")
    .isLength({ max: 255 })
    .withMessage("reference is too long"),
  body("transferDate")
    .notEmpty()
    .withMessage("The transfer date is required")
    .isISO8601()
    .withMessage("transferDate must be a valid date (YYYY-MM-DD)"),
  body("transferBank")
    .trim()
    .notEmpty()
    .withMessage("The sending bank / method is required")
    .isLength({ max: 150 })
    .withMessage("bank / method is too long"),
  body("note")
    .optional({ nullable: true })
    .isString()
    .withMessage("note must be text")
    .isLength({ max: 2000 })
    .withMessage("note is too long")
];
