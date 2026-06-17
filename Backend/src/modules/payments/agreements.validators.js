import { body, param, query } from "express-validator";

export const createAgreementValidator = [
  body("caseId").isUUID().withMessage("Invalid case ID format"),
  body("clientUserId").isUUID().withMessage("Invalid client user ID format"),
  body("agreedTotalAmount")
    .isFloat({ min: 0.01 })
    .withMessage("Agreed total amount must be greater than zero"),
  body("frequency")
    .optional()
    .isIn(["lump_sum", "monthly", "quarterly", "semi_annual"])
    .withMessage("Invalid payment frequency"),
  body("installmentCount")
    .optional()
    .isInt({ min: 1, max: 48 })
    .withMessage("Installment count must be between 1 and 48"),
  body("installments")
    .optional()
    .isArray()
    .withMessage("Installments must be an array"),
  body("installments.*.amount")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Each installment amount must be greater than zero"),
  body("installments.*.dueDate")
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Each installment requires a valid due date (YYYY-MM-DD)"),
];

export const getAgreementValidator = [
  param("agreementId").isUUID().withMessage("Invalid agreement ID format"),
];

export const caseIdParamValidator = [
  param("caseId").isUUID().withMessage("Invalid case ID format"),
];

export const updateAgreementValidator = [
  param("agreementId").isUUID().withMessage("Invalid agreement ID format"),
  body("status")
    .optional()
    .isIn(["draft", "active", "completed", "cancelled"])
    .withMessage("Invalid agreement status"),
];

export const receiptIdValidator = [
  param("receiptId").isUUID().withMessage("Invalid receipt ID format"),
];

export const optionalCaseIdQueryValidator = [
  query("caseId").optional().isUUID().withMessage("Invalid case ID format"),
];

export const createPaymentPlanValidator = [
  param("caseId").isUUID().withMessage("Invalid case ID format"),
  body("totalAmount")
    .isFloat({ min: 0.01 })
    .withMessage("Total amount must be greater than zero"),
  body("installmentCount")
    .isInt({ min: 1, max: 48 })
    .withMessage("Installment count must be between 1 and 48"),
  // Optional lawyer-customized schedule: each row may carry a due date. Amounts
  // are always recomputed server-side, so only the date matters here.
  body("installments")
    .optional()
    .isArray({ max: 48 })
    .withMessage("Installments must be an array"),
  body("installments.*.dueDate")
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Each installment requires a valid due date (YYYY-MM-DD)"),
];
