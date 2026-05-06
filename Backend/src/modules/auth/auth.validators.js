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

  body("consultationFee")
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage("Consultation fee must be a valid amount")
    .toFloat(),

  body("consultation_fee")
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage("Consultation fee must be a valid amount")
    .toFloat(),

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
    .toBoolean()
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
