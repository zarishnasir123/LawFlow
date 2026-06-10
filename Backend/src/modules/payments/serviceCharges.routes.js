import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import {
  updateServiceCharges,
  getServiceCharges,
  getServiceChargesByProfileId,
} from "./serviceCharges.controller.js";
import {
  updateServiceChargesValidator,
  getServiceChargesValidator,
} from "./serviceCharges.validators.js";

const router = Router();

router.put(
  "/service-charges",
  authenticate,
  authorizeRoles("lawyer"),
  updateServiceChargesValidator,
  validateRequest,
  asyncHandler(updateServiceCharges)
);

router.get(
  "/service-charges",
  authenticate,
  asyncHandler(getServiceCharges)
);

router.get(
  "/:lawyerProfileId/service-charges",
  authenticate,
  getServiceChargesValidator,
  validateRequest,
  asyncHandler(getServiceChargesByProfileId)
);

export default router;
