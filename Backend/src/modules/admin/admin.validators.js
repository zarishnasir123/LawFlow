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

// The statuses an admin can transition a payout TO. "requested" is excluded —
// that's the lawyer's starting state, not something the admin sets.
const PAYOUT_TARGET_STATUSES = PAYOUT_STATUSES.filter((s) => s !== "requested");

// GET /api/admin/payouts — optional status filter (any real payout status).
export const listPayoutsValidator = [
  query("status")
    .optional()
    .isIn(PAYOUT_STATUSES)
    .withMessage(`status must be one of: ${PAYOUT_STATUSES.join(", ")}`)
];

// PATCH /api/admin/payouts/:payoutId — id must be a UUID; status is required
// and must be a valid target; reference/note are optional free text (the
// service additionally requires a reference when status === 'paid').
export const updatePayoutValidator = [
  param("payoutId").isUUID().withMessage("payoutId must be a valid UUID"),
  body("status")
    .isIn(PAYOUT_TARGET_STATUSES)
    .withMessage(`status must be one of: ${PAYOUT_TARGET_STATUSES.join(", ")}`),
  body("reference")
    .optional({ nullable: true })
    .isString()
    .withMessage("reference must be text")
    .isLength({ max: 255 })
    .withMessage("reference is too long"),
  body("note")
    .optional({ nullable: true })
    .isString()
    .withMessage("note must be text")
    .isLength({ max: 2000 })
    .withMessage("note is too long")
];
