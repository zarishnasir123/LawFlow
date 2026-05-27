import { body, param } from "express-validator";

// Hard cap on the HTML snapshot we store per request. ~2 MB is plenty
// for our plaint templates even with a few embedded base64 images, and
// keeps a single bad request from pushing tens of MB into the DB row.
const MAX_HTML_BYTES = 2 * 1024 * 1024;

// Hard cap on a base64 signature image. Typed-name canvas or upload
// produces ~10–30 KB PNGs; 1 MB is generous headroom and stops anyone
// using the sign endpoint as a binary blob upload channel.
const MAX_SIGNATURE_BYTES = 1024 * 1024;

// Per-page PNG capture from html2canvas at submit time. An A4 page at
// devicePixelRatio=2 lands around 400–800 KB; 3 MB is generous headroom
// for high-DPI captures with embedded images, while still bounding the
// HTTP body for a typical 1-page request well under the JSON parser's
// limit. Caps applied per element in the array AND on the array length.
const MAX_PAGE_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_PAGES_PER_SUBMIT = 50;

const uuidParam = (name) =>
  param(name).isUUID().withMessage(`${name} must be a valid UUID`);

// ===== Lawyer-side validators =====

// New payload for the per-signer-per-row model:
//   { clientEmail, pageAssignments: [{ pageIndex, signers: [...] }] }
// Lawyer composes per-page signer choices in the editor and posts the
// whole batch in one go. Backend splits into rows by signer.
export const createSignatureRequestValidator = [
  uuidParam("caseId"),
  body("clientEmail")
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage("clientEmail must be a valid email address")
    .isLength({ max: 200 }),
  body("pageAssignments")
    .isArray({ min: 1 })
    .withMessage("pageAssignments must be a non-empty array"),
  body("pageAssignments.*.pageIndex")
    .isInt({ min: 0 })
    .withMessage("Each pageAssignment.pageIndex must be a non-negative integer"),
  body("pageAssignments.*.signers")
    .isArray({ min: 1 })
    .withMessage("Each pageAssignment must list at least one signer")
    .custom((arr) =>
      arr.every((s) => s === "client" || s === "lawyer")
    )
    .withMessage("signers must be a subset of ['client', 'lawyer']"),
  // Snapshot of the rendered editor HTML, optional but recommended —
  // the frontend gets it by stringing together the live <section.docx>
  // page elements. If omitted, the service falls back to cases.edited_html.
  body("documentHtmlSnapshot")
    .optional()
    .isString()
    .withMessage("documentHtmlSnapshot must be a string")
    .isLength({ max: MAX_HTML_BYTES })
    .withMessage(`documentHtmlSnapshot must be at most ${MAX_HTML_BYTES} bytes`),
];

export const caseIdParamValidator = [uuidParam("caseId")];

export const requestIdParamValidator = [uuidParam("requestId")];

// ===== Recipient-side validators (used by both client + lawyer signers) =====

// Submit a signature image. requestId path param is a UUID; the body
// carries the base64 PNG/JPEG data URL.
export const submitSignatureValidator = [
  uuidParam("requestId"),
  body("signatureImage")
    .isString()
    .withMessage("signatureImage is required")
    .matches(/^data:image\/(png|jpeg|jpg);base64,/)
    .withMessage("signatureImage must be a PNG/JPEG data URL")
    .isLength({ max: MAX_SIGNATURE_BYTES })
    .withMessage("Signature image is too large"),
  // Placement metadata captured when the signer drag-dropped their
  // signature on the page. Optional: a signer can submit without a
  // placement (e.g., they typed but didn't drag), in which case the
  // PDF compile uses a default position. Stored values are FRACTIONS
  // (0..1) of the page so they survive any rendered page-size scale.
  body("signaturePlacement").optional({ nullable: true }).isObject(),
  body("signaturePlacement.pageIndex")
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage("signaturePlacement.pageIndex must be a non-negative integer"),
  body("signaturePlacement.xPct")
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 1 }),
  body("signaturePlacement.yPct")
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 1 }),
  body("signaturePlacement.widthPct")
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 1 }),
  body("signaturePlacement.heightPct")
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 1 }),
  // Per-page rendered captures the signer's browser produced after
  // placing the signature. The compiler uses these directly to build
  // the final PDF — see signatures.compiler.js.
  body("signedPages")
    .optional({ nullable: true })
    .isArray({ max: MAX_PAGES_PER_SUBMIT })
    .withMessage(
      `signedPages must be an array of at most ${MAX_PAGES_PER_SUBMIT} items`
    ),
  body("signedPages.*.pageIndex")
    .isInt({ min: 0 })
    .withMessage("signedPages[].pageIndex must be a non-negative integer"),
  body("signedPages.*.imageDataUrl")
    .isString()
    .matches(/^data:image\/(png|jpeg|jpg);base64,/)
    .withMessage("signedPages[].imageDataUrl must be a PNG/JPEG data URL")
    .isLength({ max: MAX_PAGE_IMAGE_BYTES })
    .withMessage("signedPages[].imageDataUrl is too large"),
];

// ===== Lawyer-side: save edited HTML state =====

export const saveEditedDocumentValidator = [
  uuidParam("caseId"),
  body("editedHtml")
    .isString()
    .withMessage("editedHtml is required")
    .isLength({ min: 0, max: MAX_HTML_BYTES })
    .withMessage(`editedHtml must be at most ${MAX_HTML_BYTES} bytes`),
];
