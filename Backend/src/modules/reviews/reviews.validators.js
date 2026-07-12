import { body, param } from "express-validator";

export const submitReviewValidator = [
  body("lawyerProfileId")
    .isUUID()
    .withMessage("lawyerProfileId must be a valid UUID"),
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("rating must be a whole number from 1 to 5"),
  body("comment")
    .optional({ nullable: true })
    .isString()
    .withMessage("comment must be a string")
    .bail()
    .trim()
    .isLength({ max: 1500 })
    .withMessage("Review is too long (1500 characters max)"),
];

export const lawyerProfileIdParamValidator = [
  param("lawyerProfileId")
    .isUUID()
    .withMessage("lawyerProfileId must be a valid UUID"),
];

export const reviewIdParamValidator = [
  param("reviewId").isUUID().withMessage("reviewId must be a valid UUID"),
];

export const reportReviewValidator = [
  param("reviewId").isUUID().withMessage("reviewId must be a valid UUID"),
  body("reason")
    .optional({ nullable: true })
    .isString()
    .bail()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason is too long (500 characters max)"),
];
