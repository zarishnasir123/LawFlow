import { body, param } from "express-validator";

// Hard cap on the HTML snapshot we store per request. ~2 MB is plenty
// for our plaint templates even with a few embedded base64 images, and
// keeps a single bad request from pushing tens of MB into the DB row.
const MAX_HTML_BYTES = 2 * 1024 * 1024;

// Hard cap on a base64 signature image. Real signature pads produce
// ~10-30 KB PNGs; 1 MB is generous headroom and stops anyone using the
// public endpoint as a binary blob upload channel.
const MAX_SIGNATURE_BYTES = 1024 * 1024;

const uuidParam = (name) =>
  param(name).isUUID().withMessage(`${name} must be a valid UUID`);

export const createSignatureRequestValidator = [
  uuidParam("caseId"),
  body("recipientEmail")
    .isEmail()
    .withMessage("recipientEmail must be a valid email address")
    .isLength({ max: 200 }),
  body("recipientName").optional().isString().isLength({ max: 200 }),
  body("documentHtmlSnapshot")
    .isString()
    .withMessage("documentHtmlSnapshot is required")
    .isLength({ min: 1, max: MAX_HTML_BYTES })
    .withMessage(`Document snapshot must be 1–${MAX_HTML_BYTES} bytes`),
  body("pageIndices")
    .optional({ nullable: true })
    .isArray()
    .withMessage("pageIndices must be an array")
    .custom((arr) => {
      if (!Array.isArray(arr)) return false;
      return arr.every(
        (n) => typeof n === "number" && Number.isInteger(n) && n >= 0
      );
    })
    .withMessage("pageIndices must contain non-negative integers"),
  body("requiresClientSignature").optional().isBoolean(),
  body("requiresLawyerSignature").optional().isBoolean(),
];

export const caseIdParamValidator = [uuidParam("caseId")];

export const requestIdParamValidator = [uuidParam("requestId")];

// Tokens are URL-safe base64 of 32 random bytes — 43 chars from the
// alphabet [A-Za-z0-9_-]. We're strict here so the public endpoint
// returns 404 on anything obviously malformed without touching the DB.
export const tokenParamValidator = [
  param("token")
    .isString()
    .matches(/^[A-Za-z0-9_-]{40,64}$/)
    .withMessage("Invalid signing link"),
];

export const submitSignatureValidator = [
  ...tokenParamValidator,
  body("signatureImage")
    .isString()
    .withMessage("signatureImage is required")
    .matches(/^data:image\/(png|jpeg|jpg);base64,/)
    .withMessage("signatureImage must be a PNG/JPEG data URL")
    .isLength({ max: MAX_SIGNATURE_BYTES })
    .withMessage("Signature image is too large"),
];

export const saveEditedDocumentValidator = [
  uuidParam("caseId"),
  body("editedHtml")
    .isString()
    .withMessage("editedHtml is required")
    .isLength({ min: 0, max: MAX_HTML_BYTES })
    .withMessage(`editedHtml must be at most ${MAX_HTML_BYTES} bytes`),
];
