import { Router } from "express";

import {
  getAdminCaseDetailHandler,
  getDashboardStatsHandler,
  getRecentActivityHandler,
  listAdminCasesHandler
} from "./admin.controller.js";
import {
  adminCaseIdParamValidator,
  listAdminCasesValidator
} from "./admin.validators.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { validateRequest } from "../../middleware/validateRequest.js";

const router = Router();

// Every admin endpoint here is admin-only. Mirrors the registrar module's
// router-level gate so individual routes don't repeat the middleware.
router.use(authenticate, authorizeRoles("admin"));

router.get("/dashboard-stats", asyncHandler(getDashboardStatsHandler));
router.get("/recent-activity", asyncHandler(getRecentActivityHandler));

// Case traceability (admin-only, gated by the router.use above).
router.get(
  "/cases",
  listAdminCasesValidator,
  validateRequest,
  asyncHandler(listAdminCasesHandler)
);
router.get(
  "/cases/:caseId",
  adminCaseIdParamValidator,
  validateRequest,
  asyncHandler(getAdminCaseDetailHandler)
);

export default router;
