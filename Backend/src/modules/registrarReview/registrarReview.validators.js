import { body, param, query } from "express-validator";

// caseId arrives in the URL on every R2–R4 endpoint. Validate it before the
// DB lookup so a malformed id surfaces as a clean 400 instead of a Postgres
// 500 (matches the caseIdParamValidator convention in the cases module).
const uuidParam = (name) =>
  param(name).isUUID().withMessage(`${name} must be a valid UUID`);

export const caseIdParamValidator = [uuidParam("caseId")];

// R1 list: the registrar queue can be filtered by decision status. The param
// is OPTIONAL — omitting it keeps the original "submitted queue" behaviour, so
// the existing queue page is unaffected. Anything outside the allowed set is a
// clean 400 (validateRequest) instead of silently falling through to an empty
// list. Only these three statuses are listable here: 'draft' cases belong to
// the lawyer, never the registrar, so they are intentionally excluded.
export const listRegistrarCasesValidator = [
  query("status")
    .optional()
    .isIn(["submitted", "accepted", "returned"])
    .withMessage("status must be one of: submitted, accepted, returned")
];

// R4 return: remarks is the registrar's reason for bouncing the case back.
// Required, must be non-empty once trimmed, and capped so a single field
// can't balloon the cases.review_remarks TEXT column. .trim() also sanitises
// the value in place so the controller/service write the trimmed text.
export const returnCaseValidator = [
  uuidParam("caseId"),
  body("remarks")
    .exists({ checkNull: true })
    .withMessage("Remarks are required")
    .bail()
    .isString()
    .withMessage("Remarks must be text")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Remarks are required")
    .bail()
    .isLength({ max: 2000 })
    .withMessage("Remarks must be 2000 characters or less")
];
