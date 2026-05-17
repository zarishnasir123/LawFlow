import { body, param, query } from "express-validator";

import { isAllowedDistrictCnic, isValidPakistanCnic } from "../../utils/cnic.js";
import {
  canEmailDomainReceiveMail,
  isReservedEmailDomain
} from "../../utils/email.js";
import { isSupportedTehsil } from "../../utils/location.js";

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

function validateTehsil(_, { req }) {
  const tehsil = getTrimmedField(req.body, "assignedTehsil", "assigned_tehsil");

  if (tehsil && !isSupportedTehsil(tehsil)) {
    throw new Error("Assigned tehsil is not supported by this LawFlow deployment");
  }

  return true;
}

export const createRegistrarValidator = [
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

  requireStringField(["phone", "phoneNumber", "phone_number"], "Phone number", { max: 20 }),
  body().custom(validateCnic),

  // No password field on create: the backend generates a temporary password
  // server-side and emails it to the registrar. The registrar rotates it on
  // first login via /api/auth/change-password.

  optionalStringField(["assignedCourt", "assigned_court"], "Assigned court", { max: 150 }),
  optionalStringField(["assignedTehsil", "assigned_tehsil"], "Assigned tehsil", { max: 100 }),
  body().custom(validateTehsil)
];

export const updateRegistrarValidator = [
  requireStringField(["firstName", "first_name"], "First name", { max: 100 }),
  requireStringField(["lastName", "last_name"], "Last name", { max: 100 }),
  requireStringField(["phone", "phoneNumber", "phone_number"], "Phone number", { max: 20 }),

  optionalStringField(["assignedCourt", "assigned_court"], "Assigned court", { max: 150 }),
  optionalStringField(["assignedTehsil", "assigned_tehsil"], "Assigned tehsil", { max: 100 }),
  body().custom(validateTehsil)
];

export const setRegistrarStatusValidator = [
  body("accountStatus")
    .trim()
    .isIn(["active", "inactive"])
    .withMessage("Status must be active or inactive")
];

export const listRegistrarsValidator = [
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

// Reused on every endpoint that reads :registrarProfileId from the URL.
// Without this, a malformed param hits Postgres directly and surfaces as a
// generic 500.
export const registrarProfileIdParamValidator = [
  param("registrarProfileId")
    .isUUID()
    .withMessage("Registrar id must be a valid UUID")
];
