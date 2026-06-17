import { body, query } from "express-validator";

import { isAllowedDistrictCnic, isValidPakistanCnic } from "../../utils/cnic.js";
import {
  canEmailDomainReceiveMail,
  isReservedEmailDomain
} from "../../utils/email.js";
import { isSupportedTehsil } from "../../utils/location.js";

const passwordRule = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function getField(payload, ...names) {
  for (const name of names) {
    if (payload[name] !== undefined) {
      return payload[name];
    }
  }

  return undefined;
}

function getTrimmedField(payload, ...names) {
  const value = getField(payload, ...names);
  return typeof value === "string" ? value.trim() : value;
}

function requireStringField(fieldNames, label, { max } = {}) {
  return body().custom((_, { req }) => {
    const value = getTrimmedField(req.body, ...fieldNames);

    if (!value) {
      throw new Error(`${label} is required`);
    }

    if (typeof value !== "string") {
      throw new Error(`${label} must be text`);
    }

    if (max && value.length > max) {
      throw new Error(`${label} must be ${max} characters or less`);
    }

    return true;
  });
}

function optionalStringField(fieldNames, label, { max } = {}) {
  return body().custom((_, { req }) => {
    const value = getTrimmedField(req.body, ...fieldNames);

    if (!value) {
      return true;
    }

    if (typeof value !== "string") {
      throw new Error(`${label} must be text`);
    }

    if (max && value.length > max) {
      throw new Error(`${label} must be ${max} characters or less`);
    }

    return true;
  });
}

function rejectReservedEmailDomain(value) {
  if (isReservedEmailDomain(value)) {
    throw new Error("Use a real email address, not a reserved test domain");
  }

  return true;
}

async function requireReceivableEmailDomain(value) {
  const canReceiveMail = await canEmailDomainReceiveMail(value);

  if (!canReceiveMail) {
    throw new Error("Email domain cannot receive mail");
  }

  return true;
}

function validateCnic(_, { req }) {
  const value = getTrimmedField(req.body, "cnic", "CNIC");

  if (!isValidPakistanCnic(value)) {
    throw new Error("CNIC must follow Pakistan format: 12345-1234567-1");
  }

  if (!isAllowedDistrictCnic(value)) {
    throw new Error("CNIC is not allowed for the configured district scope");
  }

  return true;
}

function validatePasswordConfirmation(_, { req }) {
  const password = req.body.password;
  const confirmPassword = getField(req.body, "confirmPassword", "confirm_password");

  if (confirmPassword !== password) {
    throw new Error("Password and confirm password do not match");
  }

  return true;
}

function requireUploadedFile({ field, label, allowedMimeTypes }) {
  return body().custom((_, { req }) => {
    const file = req.files?.[field]?.[0];

    if (!file) {
      throw new Error(`${label} is required`);
    }

    if (Array.isArray(allowedMimeTypes) && allowedMimeTypes.length > 0) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        const expected = allowedMimeTypes
          .map((value) => value.replace(/^.*\//, "").toUpperCase())
          .join(" or ");
        throw new Error(`${label} must be ${expected}`);
      }
    }

    return true;
  });
}

function requireDocumentReference({ objectName, urlNames, label }) {
  return body().custom((_, { req }) => {
    const document = req.body[objectName];
    const documentUrl = getTrimmedField(req.body, ...urlNames);

    if (documentUrl) {
      return true;
    }

    if (!document || typeof document !== "object") {
      throw new Error(`${label} metadata or URL is required`);
    }

    const storageBucket = getTrimmedField(document, "storageBucket", "storage_bucket");
    const storagePath = getTrimmedField(document, "storagePath", "storage_path");

    if (!storageBucket || !storagePath) {
      throw new Error(`${label} storage bucket and path are required`);
    }

    return true;
  });
}

function validateDocumentMimeType({ objectName, urlNames = [], allowedMimeTypes, allowedExtensions, label }) {
  return body().custom((_, { req }) => {
    const document = req.body[objectName];

    if ((!document || typeof document !== "object") && urlNames.length === 0) {
      return true;
    }

    const documentUrl = getTrimmedField(req.body, ...urlNames)?.toLowerCase();
    const mimeType = document && typeof document === "object"
      ? getTrimmedField(document, "mimeType", "mime_type")?.toLowerCase()
      : null;
    const storagePath = document && typeof document === "object"
      ? getTrimmedField(document, "storagePath", "storage_path")?.toLowerCase()
      : documentUrl;
    const fileName = document && typeof document === "object"
      ? getTrimmedField(document, "fileName", "file_name")?.toLowerCase()
      : documentUrl;
    const hasAllowedMimeType = mimeType ? allowedMimeTypes.includes(mimeType) : true;
    const pathOrName = fileName || storagePath || "";
    const hasAllowedExtension = allowedExtensions.some((extension) => pathOrName.endsWith(extension));

    if (!hasAllowedMimeType || !hasAllowedExtension) {
      throw new Error(`${label} must be ${allowedExtensions.join(" or ").replaceAll(".", "").toUpperCase()}`);
    }

    return true;
  });
}

export const commonRegistrationValidator = [
  requireStringField(["firstName", "first_name"], "First name", { max: 100 }),
  requireStringField(["lastName", "last_name"], "Last name", { max: 100 }),

  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .bail()
    .customSanitizer((value) => value.toLowerCase())
    .custom(rejectReservedEmailDomain)
    .bail()
    .custom(requireReceivableEmailDomain),

  requireStringField(["phoneNumber", "phone_number", "phone"], "Phone number", { max: 20 }),
  body().custom(validateCnic),

  body("password")
    .matches(passwordRule)
    .withMessage("Password must be at least 8 characters and include one number and one special character"),

  body().custom(validatePasswordConfirmation)
];

export const registerClientValidator = [
  ...commonRegistrationValidator,

  optionalStringField(["address"], "Address"),
  optionalStringField(["city"], "City", { max: 100 }),

  optionalStringField(["tehsil"], "Tehsil", { max: 100 }),
  body().custom((_, { req }) => {
    const tehsil = getTrimmedField(req.body, "tehsil");

    if (tehsil && !isSupportedTehsil(tehsil)) {
      throw new Error("Tehsil is not supported by this LawFlow deployment");
    }

    return true;
  })
];

// PATCH /auth/me — every field optional so the client can change just
// the ones they want. Each validator mirrors the registration rules
// (same CNIC regex, same email domain checks, same length caps) so a
// value that's legal at sign-up is legal here too.
export const updateMyProfileValidator = [
  optionalStringField(["firstName", "first_name"], "First name", { max: 100 }),
  optionalStringField(["lastName", "last_name"], "Last name", { max: 100 }),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .bail()
    .customSanitizer((value) => value.toLowerCase())
    .custom(rejectReservedEmailDomain)
    .bail()
    .custom(requireReceivableEmailDomain),

  optionalStringField(["phoneNumber", "phone_number", "phone"], "Phone number", { max: 20 }),

  // CNIC is the user's national identity number. It's set at
  // registration (or by an admin for admin-provisioned accounts) and
  // is treated as immutable from there on — changing it would silently
  // rewrite the identity that audit trails, lawyer verifications, and
  // unique constraints all depend on. The Edit Profile UI for every
  // role renders CNIC as a locked field; this validator is the
  // defense-in-depth layer for anyone bypassing the UI.
  body().custom((_, { req }) => {
    const value = getTrimmedField(req.body, "cnic", "CNIC");
    if (value === undefined || value === "") return true;
    throw new Error("CNIC cannot be changed. Contact an administrator if it was set incorrectly.");
  }),

  optionalStringField(["address"], "Address"),
  optionalStringField(["city"], "City", { max: 100 }),
  // Tehsil here is intentionally NOT cross-checked against
  // SUPPORTED_TEHSILS. The PATCH endpoint accepts any string the
  // client types so they can record their actual tehsil even when
  // the deployment's routing list only covers a few. The strict
  // check still applies at registration where the value gates
  // lawyer-side case routing.
  optionalStringField(["tehsil"], "Tehsil", { max: 100 }),

  // Lawyer-specific editable fields. Mirror the same rules
  // registerLawyerValidator uses but flipped to optional, because
  // PATCH semantics only update what's sent. Bar license number,
  // documents, and verification status are intentionally absent
  // here — any of those need a re-verification flow we don't
  // expose to the lawyer.
  optionalStringField(["specialization"], "Specialization", { max: 150 }),
  body().custom((_, { req }) => {
    const specialization = getTrimmedField(req.body, "specialization");
    if (!specialization) return true;
    if (!["Civil", "Family", "civil", "family"].includes(specialization)) {
      throw new Error("Specialization must be Civil or Family");
    }
    return true;
  }),

  optionalStringField(["districtBar", "district_bar"], "District bar", { max: 150 }),

  body("experienceYears")
    .optional({ nullable: true })
    .isInt({ min: 0, max: 80 })
    .withMessage("Experience years must be a valid number")
    .toInt(),
  body("experience_years")
    .optional({ nullable: true })
    .isInt({ min: 0, max: 80 })
    .withMessage("Experience years must be a valid number")
    .toInt(),

  // Short free-text intro shown on the client directory + lawyer
  // profile. Registration never collects this — the field only
  // exists on the Edit Profile form, so it's optional everywhere.
  // 120 chars is a hard cap by product call (tweet-length); the
  // frontend mirrors the limit so the user can't paste a longer
  // value past the maxLength attribute.
  optionalStringField(["bio"], "About", { max: 120 })
];

export const registerLawyerValidator = [
  ...commonRegistrationValidator,

  requireStringField(["specialization"], "Specialization", { max: 150 }),
  body().custom((_, { req }) => {
    const specialization = getTrimmedField(req.body, "specialization");

    if (!["Civil", "Family", "civil", "family"].includes(specialization)) {
      throw new Error("Specialization must be Civil or Family");
    }

    return true;
  }),

  requireStringField(["districtBar", "district_bar"], "District bar", { max: 150 }),
  requireStringField(["barLicenseNumber", "bar_license_number"], "Bar license number", { max: 100 }),

  body("experienceYears")
    .optional({ nullable: true })
    .isInt({ min: 0, max: 80 })
    .withMessage("Experience years must be a valid number")
    .toInt(),

  body("experience_years")
    .optional({ nullable: true })
    .isInt({ min: 0, max: 80 })
    .withMessage("Experience years must be a valid number")
    .toInt(),

  requireUploadedFile({
    field: "degreeDocument",
    label: "Law degree document",
    allowedMimeTypes: ["application/pdf"]
  }),

  requireUploadedFile({
    field: "licenseCardFrontImage",
    label: "Bar license card front picture",
    allowedMimeTypes: ["image/jpeg", "image/png"]
  }),

  requireUploadedFile({
    field: "licenseCardBackImage",
    label: "Bar license card back picture",
    allowedMimeTypes: ["image/jpeg", "image/png"]
  }),

  body("extractedCnic")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body("extracted_cnic")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body("ocrReadable")
    .optional()
    .isBoolean()
    .withMessage("OCR readable must be true or false")
    .toBoolean(),

  body("ocr_readable")
    .optional()
    .isBoolean()
    .withMessage("OCR readable must be true or false")
    .toBoolean()
];

export const verifyEmailValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .bail()
    .customSanitizer((value) => value.toLowerCase()),

  body("otp")
    .trim()
    .matches(/^\d{6}$/)
    .withMessage("OTP must be a 6-digit code")
];

export const resendVerificationOtpValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .bail()
    .customSanitizer((value) => value.toLowerCase())
];

export const loginValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .bail()
    .customSanitizer((value) => value.toLowerCase()),

  body("password")
    .notEmpty()
    .withMessage("Password is required"),

  body("rememberMe")
    .optional()
    .isBoolean()
    .withMessage("Remember me must be true or false")
    .toBoolean(),

  // The frontend role tabs pass the expected role so wrong-tab attempts get
  // a generic "invalid credentials" instead of leaking role-specific status
  // (e.g. "your lawyer account is pending approval") to someone who's signed
  // in via the Client / Admin tab.
  body("expectedRole")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["client", "lawyer", "admin", "registrar"])
    .withMessage("Invalid expected role")
];

export const listPendingLawyersValidator = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),

  query("offset")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Offset must be zero or a positive integer")
    .toInt()
];

export const listLawyerRejectionHistoryValidator = [
  ...listPendingLawyersValidator,

  query("search")
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage("Search must be 120 characters or less")
];

export const reviewLawyerValidator = [
  body("status")
    .trim()
    .isIn(["approved", "rejected"])
    .withMessage("Status must be approved or rejected"),

  body("remarks")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Remarks must be 1000 characters or less"),

  body("remarks")
    .if(body("status").equals("rejected"))
    .trim()
    .notEmpty()
    .withMessage("Remarks are required when rejecting a lawyer registration")
];

export const suspendLawyerValidator = [
  body("reason")
    .trim()
    .notEmpty()
    .withMessage("Suspension reason is required")
    .isLength({ max: 1000 })
    .withMessage("Suspension reason must be 1000 characters or less")
];

export const forgotPasswordValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .bail()
    .customSanitizer((value) => value.toLowerCase())
];

export const resetPasswordValidator = [
  body("token")
    .trim()
    .notEmpty()
    .withMessage("Reset token is required")
    .isHexadecimal()
    .withMessage("Invalid token format")
    .isLength({ min: 64, max: 64 })
    .withMessage("Invalid token length"),

  body("password")
    .matches(passwordRule)
    .withMessage("Password must be at least 8 characters and include one number and one special character"),

  body().custom(validatePasswordConfirmation)
];

// Confirm-new-password is checked against newPassword (not the unrelated
// `password` field used by /reset-password). Kept inline because it's the
// only place these field names appear.
function validateNewPasswordConfirmation(_, { req }) {
  const newPassword = req.body.newPassword;
  const confirm = req.body.confirmNewPassword ?? req.body.confirm_new_password;

  if (confirm === undefined) {
    return true;
  }

  if (confirm !== newPassword) {
    throw new Error("New password and confirm password do not match");
  }

  return true;
}

export const changePasswordValidator = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .matches(passwordRule)
    .withMessage("New password must be at least 8 characters and include one number and one special character"),

  body().custom(validateNewPasswordConfirmation)
];
