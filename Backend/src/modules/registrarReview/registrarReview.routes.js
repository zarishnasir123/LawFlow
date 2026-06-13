import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { validateRequest } from "../../middleware/validateRequest.js";

import {
  approveRegistrarCase,
  getRegistrarCase,
  listRegistrarQueue,
  returnRegistrarCase
} from "./registrarReview.controller.js";
import {
  caseIdParamValidator,
  listRegistrarCasesValidator,
  returnCaseValidator
} from "./registrarReview.validators.js";

const router = Router();

// Every route here is for the logged-in registrar reviewing cases in their own
// tehsil. This is DISTINCT from the admin-only registrar management API
// (modules/registrar) mounted at /api/registrars. Gate the whole router to the
// 'registrar' role; the service enforces the per-case tehsil ownership.
router.use(authenticate, authorizeRoles("registrar"));

// R1: the registrar's cases in their tehsil, filtered by ?status= (default
// 'submitted', the original oldest-first queue). Validates the status param so
// anything outside {submitted, accepted, returned} is a clean 400.
router.get(
  "/cases",
  listRegistrarCasesValidator,
  validateRequest,
  asyncHandler(listRegistrarQueue)
);

// R2: one case detail + signed PDF URL. 404 on tehsil mismatch.
router.get(
  "/cases/:caseId",
  caseIdParamValidator,
  validateRequest,
  asyncHandler(getRegistrarCase)
);

// R3: approve -> status='accepted'.
router.patch(
  "/cases/:caseId/approve",
  caseIdParamValidator,
  validateRequest,
  asyncHandler(approveRegistrarCase)
);

// R4: return -> status='returned' with required remarks.
router.patch(
  "/cases/:caseId/return",
  returnCaseValidator,
  validateRequest,
  asyncHandler(returnRegistrarCase)
);

export default router;
