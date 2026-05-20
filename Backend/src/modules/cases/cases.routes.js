import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { validateRequest } from "../../middleware/validateRequest.js";

import {
  createMyCase,
  downloadCaseTemplate,
  getCaseTypes,
  getMyCase,
  listMyCases,
  patchMyCase
} from "./cases.controller.js";
import {
  caseIdParamValidator,
  caseTypeCodeParamValidator,
  createCaseValidator,
  updateCaseValidator
} from "./cases.validators.js";

const router = Router();

// Case-type catalog is needed by the lawyer's "create case" picker. Any
// authenticated user can read it — no PII, just the supported template list.
router.get("/types", authenticate, asyncHandler(getCaseTypes));

// .docx template download for a given case_types.code. The Tiptap editor
// (Module 3 Phase 2) calls this endpoint to bootstrap the editor surface with
// the canonical plaint scaffolding for the case type the lawyer picked.
// Restricted to lawyers because clients/registrars don't draft plaints.
router.get(
  "/types/:code/template",
  authenticate,
  authorizeRoles("lawyer"),
  caseTypeCodeParamValidator,
  validateRequest,
  asyncHandler(downloadCaseTemplate)
);

router.post(
  "/",
  authenticate,
  authorizeRoles("lawyer"),
  createCaseValidator,
  validateRequest,
  asyncHandler(createMyCase)
);

router.get(
  "/",
  authenticate,
  authorizeRoles("lawyer"),
  asyncHandler(listMyCases)
);

router.get(
  "/:caseId",
  authenticate,
  authorizeRoles("lawyer"),
  caseIdParamValidator,
  validateRequest,
  asyncHandler(getMyCase)
);

router.patch(
  "/:caseId",
  authenticate,
  authorizeRoles("lawyer"),
  updateCaseValidator,
  validateRequest,
  asyncHandler(patchMyCase)
);

export default router;
