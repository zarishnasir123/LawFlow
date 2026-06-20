import { body, param, query } from "express-validator";

export const getProposedHearingSlotValidator = [
  param("caseId")
    .isUUID()
    .withMessage("Invalid case ID format.")
];

export const confirmHearingValidator = [
  param("caseId")
    .isUUID()
    .withMessage("Invalid case ID format."),
  body("date")
    .isISO8601()
    .withMessage("Date must be a valid ISO 8601 date (YYYY-MM-DD).")
    .bail(),
  body("startTime")
    .trim()
    .isIn(["09:00", "10:00", "11:00", "12:00", "14:00", "15:00"])
    .withMessage("Invalid time slot. Permitted slots are 09:00, 10:00, 11:00, 12:00, 14:00, 15:00."),
  body("courtroomId")
    .isUUID()
    .withMessage("Invalid courtroom ID format."),
  body("hearingType")
    .trim()
    .notEmpty()
    .withMessage("Hearing type is required.")
];

export const recordOutcomeValidator = [
  param("hearingId")
    .isUUID()
    .withMessage("Invalid hearing ID format."),
  body("outcome")
    .trim()
    .isIn(["completed", "adjourned", "disposed"])
    .withMessage("Outcome must be completed, adjourned, or disposed."),
  body("remarks")
    .optional({ nullable: true })
    .trim(),
  body("nextHearingType")
    .optional({ nullable: true })
    .trim()
];

export const rescheduleHearingValidator = [
  param("hearingId")
    .isUUID()
    .withMessage("Invalid hearing ID format."),
  body("newDate")
    .isISO8601()
    .withMessage("New date must be a valid ISO 8601 date (YYYY-MM-DD).")
    .bail(),
  body("newStartTime")
    .trim()
    .isIn(["09:00", "10:00", "11:00", "12:00", "14:00", "15:00"])
    .withMessage("Invalid time slot. Permitted slots are 09:00, 10:00, 11:00, 12:00, 14:00, 15:00."),
  body("newCourtroomId")
    .isUUID()
    .withMessage("Invalid courtroom ID format.")
];

export const cancelHearingValidator = [
  param("hearingId")
    .isUUID()
    .withMessage("Invalid hearing ID format.")
];

export const listCaseHearingsValidator = [
  param("caseId")
    .isUUID()
    .withMessage("Invalid case ID format.")
];

export const listRegistrarHearingsValidator = [
  query("status")
    .optional({ nullable: true })
    .trim()
    .isIn(["proposed", "scheduled", "completed", "adjourned", "cancelled"])
    .withMessage("Invalid status filter.")
];

export const addHolidayValidator = [
  body("date")
    .isISO8601()
    .withMessage("Date must be a valid ISO 8601 date (YYYY-MM-DD).")
    .bail(),
  body("reason")
    .trim()
    .notEmpty()
    .withMessage("Reason is required.")
];

export const deleteHolidayValidator = [
  param("id")
    .isUUID()
    .withMessage("Invalid holiday ID format.")
];
