import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { uploadCaseAttachment } from "../../middleware/uploadCaseAttachment.js";
import { validateRequest } from "../../middleware/validateRequest.js";

import {
  createMyCase,
  deleteMyCase,
  downloadCaseTemplate,
  getCaseAttachments,
  getDashboardStats,
  getCaseTypes,
  getMyCase,
  listMyCases,
  listMySignedCases,
  patchMyCase,
  postCaseAttachment,
  removeCaseAttachment,
  submitMyCase
} from "./cases.controller.js";
import {
  attachmentIdParamValidator,
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

// "/signed" lists cases the lawyer owns where the PDF compile has
// produced a downloadable artifact. Powers the dedicated "Signed
// Documents" tracker on the signatures page. Placed before the
// `/:caseId` route so "signed" doesn't get captured as a caseId.
router.get(
  "/signed",
  authenticate,
  authorizeRoles("lawyer"),
  asyncHandler(listMySignedCases)
);

// Lawyer dashboard stat tiles (active cases / pending submissions / client
// signed / total earnings), all scoped to the logged-in lawyer. Placed before
// the `/:caseId` route — like `/signed` — so "dashboard-stats" isn't captured
// as a caseId. No params/body: everything derives from req.user.sub.
router.get(
  "/dashboard-stats",
  authenticate,
  authorizeRoles("lawyer"),
  asyncHandler(getDashboardStats)
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

// Hard-delete a case the lawyer owns. Lawyer-only + ownership enforced in SQL
// (404 if not found / not owned). Permanent removal: FK cascades clear
// dependents (attachments, signature requests, notifications, agreements,
// payments), a RESTRICT FK surfaces as a clean 409, and the case's storage
// objects are swept best-effort. Allowed at any status. No body.
router.delete(
  "/:caseId",
  authenticate,
  authorizeRoles("lawyer"),
  caseIdParamValidator,
  validateRequest,
  asyncHandler(deleteMyCase)
);

// Submit a case to the registrar for review. Ownership + the status guard
// ('draft'/'returned') and the tehsil/signed-PDF prerequisites are enforced
// in the service. No body — the case id in the URL is all we need.
router.post(
  "/:caseId/submit",
  authenticate,
  authorizeRoles("lawyer"),
  caseIdParamValidator,
  validateRequest,
  asyncHandler(submitMyCase)
);

// =====================================================================
// Case attachments — image evidence the lawyer drag-drops onto the
// docx editor canvas as floating overlays. Upload goes to Supabase
// (private bucket); list returns fresh signed URLs every call so the
// editor's restored HTML works even after the cached URL expired.
// =====================================================================
router.post(
  "/:caseId/attachments",
  authenticate,
  authorizeRoles("lawyer"),
  uploadCaseAttachment,
  caseIdParamValidator,
  validateRequest,
  asyncHandler(postCaseAttachment)
);

router.get(
  "/:caseId/attachments",
  authenticate,
  authorizeRoles("lawyer"),
  caseIdParamValidator,
  validateRequest,
  asyncHandler(getCaseAttachments)
);

router.delete(
  "/:caseId/attachments/:attachmentId",
  authenticate,
  authorizeRoles("lawyer"),
  attachmentIdParamValidator,
  validateRequest,
  asyncHandler(removeCaseAttachment)
);

export default router;
