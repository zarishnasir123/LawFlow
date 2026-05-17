import { Router } from "express";

import {
  createRegistrarHandler,
  deleteRegistrarHandler,
  getRegistrarHandler,
  listRegistrarsHandler,
  resendRegistrarCredentialsHandler,
  setRegistrarStatusHandler,
  updateRegistrarHandler
} from "./registrar.controller.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import {
  registrarManagementLimiter,
  registrarCredentialsLimiter
} from "../../middleware/rateLimiter.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import {
  createRegistrarValidator,
  listRegistrarsValidator,
  registrarProfileIdParamValidator,
  setRegistrarStatusValidator,
  updateRegistrarValidator
} from "./registrar.validators.js";

const router = Router();

// All registrar management is admin-only. Authenticated registrars use
// other modules; they never call these routes.
router.use(authenticate, authorizeRoles("admin"));

router.post(
  "/",
  registrarManagementLimiter,
  createRegistrarValidator,
  validateRequest,
  asyncHandler(createRegistrarHandler)
);

router.get(
  "/",
  listRegistrarsValidator,
  validateRequest,
  asyncHandler(listRegistrarsHandler)
);

router.get(
  "/:registrarProfileId",
  registrarProfileIdParamValidator,
  validateRequest,
  asyncHandler(getRegistrarHandler)
);

router.patch(
  "/:registrarProfileId",
  registrarManagementLimiter,
  registrarProfileIdParamValidator,
  updateRegistrarValidator,
  validateRequest,
  asyncHandler(updateRegistrarHandler)
);

router.patch(
  "/:registrarProfileId/status",
  registrarManagementLimiter,
  registrarProfileIdParamValidator,
  setRegistrarStatusValidator,
  validateRequest,
  asyncHandler(setRegistrarStatusHandler)
);

router.post(
  "/:registrarProfileId/resend-credentials",
  registrarCredentialsLimiter,
  registrarProfileIdParamValidator,
  validateRequest,
  asyncHandler(resendRegistrarCredentialsHandler)
);

router.delete(
  "/:registrarProfileId",
  registrarManagementLimiter,
  registrarProfileIdParamValidator,
  validateRequest,
  asyncHandler(deleteRegistrarHandler)
);

export default router;
