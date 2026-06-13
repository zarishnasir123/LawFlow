import { body, param } from "express-validator";

// caseId arrives in the URL on every R2–R4 endpoint. Validate it before the
// DB lookup so a malformed id surfaces as a clean 400 instead of a Postgres
// 500 (matches the caseIdParamValidator convention in the cases module).
const uuidParam = (name) =>
  param(name).isUUID().withMessage(`${name} must be a valid UUID`);

export const caseIdParamValidator = [uuidParam("caseId")];

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
