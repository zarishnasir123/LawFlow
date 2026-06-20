import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import * as controller from "./hearings.controller.js";
import * as validators from "./hearings.validators.js";

const router = Router();

// Gated by authentication
router.use(authenticate);

// Courtrooms list
router.get(
  "/courtrooms",
  authorizeRoles("registrar"),
  asyncHandler(controller.getCourtrooms)
);

// Holidays CRUD
router.get(
  "/holidays",
  authorizeRoles("registrar"),
  asyncHandler(controller.getHolidays)
);
router.post(
  "/holidays",
  authorizeRoles("registrar"),
  validators.addHolidayValidator,
  validateRequest,
  asyncHandler(controller.createHoliday)
);
router.delete(
  "/holidays/:id",
  authorizeRoles("registrar"),
  validators.deleteHolidayValidator,
  validateRequest,
  asyncHandler(controller.removeHoliday)
);

// Registrar queues and details
router.get(
  "/cases/:caseId/propose",
  authorizeRoles("registrar"),
  validators.getProposedHearingSlotValidator,
  validateRequest,
  asyncHandler(controller.getProposedSlot)
);
router.post(
  "/cases/:caseId/confirm",
  authorizeRoles("registrar"),
  validators.confirmHearingValidator,
  validateRequest,
  asyncHandler(controller.confirmProposedHearing)
);

// Hearing reschedule, cancel, outcome
router.patch(
  "/:hearingId/reschedule",
  authorizeRoles("registrar"),
  validators.rescheduleHearingValidator,
  validateRequest,
  asyncHandler(controller.reschedule)
);
router.patch(
  "/:hearingId/cancel",
  authorizeRoles("registrar"),
  validators.cancelHearingValidator,
  validateRequest,
  asyncHandler(controller.cancel)
);
router.post(
  "/:hearingId/outcome",
  authorizeRoles("registrar"),
  validators.recordOutcomeValidator,
  validateRequest,
  asyncHandler(controller.postOutcome)
);

// Registrar whole queue list
router.get(
  "/registrar",
  authorizeRoles("registrar"),
  validators.listRegistrarHearingsValidator,
  validateRequest,
  asyncHandler(controller.getRegistrarQueue)
);

// Case hearings list (shared)
router.get(
  "/cases/:caseId",
  authorizeRoles("registrar", "lawyer", "client"),
  validators.listCaseHearingsValidator,
  validateRequest,
  asyncHandler(controller.getCaseHearings)
);

// Lawyer upcoming
router.get(
  "/my",
  authorizeRoles("lawyer"),
  asyncHandler(controller.getLawyerHearings)
);

// Client upcoming
router.get(
  "/my/client",
  authorizeRoles("client"),
  asyncHandler(controller.getClientHearings)
);

export default router;
