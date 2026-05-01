import { body } from "express-validator";

import { isAllowedDistrictCnic, isValidPakistanCnic } from "../../utils/cnic.js";
import {
  canEmailDomainReceiveMail,
  isReservedEmailDomain
} from "../../utils/email.js";
import { isSupportedTehsil } from "../../utils/location.js";

const passwordRule = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

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

export const registerClientValidator = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ max: 100 })
    .withMessage("First name must be 100 characters or less"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ max: 100 })
    .withMessage("Last name must be 100 characters or less"),

  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .bail()
    .customSanitizer((value) => value.toLowerCase())
    .custom(rejectReservedEmailDomain)
    .bail()
    .custom(requireReceivableEmailDomain),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .isLength({ max: 20 })
    .withMessage("Phone number must be 20 characters or less"),

  body("cnic")
    .trim()
    .custom((value) => {
      if (!isValidPakistanCnic(value)) {
        throw new Error("CNIC must follow Pakistan format: 12345-1234567-1");
      }

      if (!isAllowedDistrictCnic(value)) {
        throw new Error("CNIC is not allowed for the configured district scope");
      }

      return true;
    }),

  body("password")
    .matches(passwordRule)
    .withMessage("Password must be at least 8 characters and include one number and one special character"),

  body("confirmPassword")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Password and confirm password do not match");
      }

      return true;
    }),

  body("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body("city")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage("City must be 100 characters or less"),

  body("tehsil")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage("Tehsil must be 100 characters or less")
    .custom((value) => {
      if (!isSupportedTehsil(value)) {
        throw new Error("Tehsil is not supported by this LawFlow deployment");
      }

      return true;
    })
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
