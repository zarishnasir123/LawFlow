import { body, param } from "express-validator";

export const updateServiceChargesValidator = [
  body("familyCaseFee")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Family case fee must be greater than zero"),
  body("civilCaseFee")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Civil case fee must be greater than zero"),
  body()
    .custom((_, { req }) => {
      const family = req.body.familyCaseFee;
      const civil = req.body.civilCaseFee;
      const hasFamily = family !== undefined && family !== null && family !== "";
      const hasCivil = civil !== undefined && civil !== null && civil !== "";
      if (!hasFamily && !hasCivil) {
        throw new Error("At least one of familyCaseFee or civilCaseFee is required");
      }
      return true;
    }),
];

export const getServiceChargesValidator = [
  param("lawyerProfileId").isUUID().withMessage("Invalid lawyer profile ID"),
];
