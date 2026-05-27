import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { validateRequest } from "../../middleware/validateRequest.js";

import {
  deleteSignatureRequest,
  getCaseSignatureRequests,
  getMyPendingSignatures,
  getMySignatureHistory,
  getMySignatureRequest,
  getSignedPdfDownloadUrl,
  postSignature,
  postSignatureRequest,
  putEditedDocument,
} from "./signatures.controller.js";
import {
  caseIdParamValidator,
  createSignatureRequestValidator,
  requestIdParamValidator,
  saveEditedDocumentValidator,
  submitSignatureValidator,
} from "./signatures.validators.js";

// =====================================================================
// Lawyer-auth routes (mounted under /api/cases/:caseId in app.js with
// mergeParams so :caseId comes through to the handlers).
// =====================================================================
export const caseSignatureRoutes = Router({ mergeParams: true });

// Save current edited HTML state of a case document.
caseSignatureRoutes.put(
  "/document",
  authenticate,
  authorizeRoles("lawyer"),
  saveEditedDocumentValidator,
  validateRequest,
  asyncHandler(putEditedDocument)
);

// List signature requests for a case + overall completion state.
caseSignatureRoutes.get(
  "/signature-requests",
  authenticate,
  authorizeRoles("lawyer"),
  caseIdParamValidator,
  validateRequest,
  asyncHandler(getCaseSignatureRequests)
);

// Create a new batch of signature requests (one row per signer).
caseSignatureRoutes.post(
  "/signature-requests",
  authenticate,
  authorizeRoles("lawyer"),
  createSignatureRequestValidator,
  validateRequest,
  asyncHandler(postSignatureRequest)
);

// Cancel a specific signature request (must belong to a case the
// lawyer owns; service performs the ownership join).
caseSignatureRoutes.delete(
  "/signature-requests/:requestId",
  authenticate,
  authorizeRoles("lawyer"),
  requestIdParamValidator,
  validateRequest,
  asyncHandler(deleteSignatureRequest)
);

// Lawyer requests a short-lived download URL for the case's final
// compiled signed PDF. Returns 409 until every required signature
// has been collected (compile is sync on the last signer's submit).
caseSignatureRoutes.get(
  "/signed-pdf",
  authenticate,
  authorizeRoles("lawyer"),
  caseIdParamValidator,
  validateRequest,
  asyncHandler(getSignedPdfDownloadUrl)
);

// =====================================================================
// Recipient-auth routes (mounted under /api/me).
//
// Same handlers serve both client and lawyer signers — access control
// is per-row via recipient_user_id matching req.user.sub, not per-role.
// A lawyer who created a batch and is ALSO the recipient (self-sign
// flow for the lawyer's own pages) hits exactly these routes.
// =====================================================================
export const mySignatureRoutes = Router();

// "What signatures am I asked to provide?" — list pending rows for me.
mySignatureRoutes.get(
  "/signature-requests",
  authenticate,
  asyncHandler(getMyPendingSignatures)
);

// "What happened with my past requests?" — list terminal-state rows
// (cancelled, signed, expired) for the recipient's activity log.
// Placed BEFORE /signature-requests/:requestId so "history" doesn't
// get captured as a requestId param.
mySignatureRoutes.get(
  "/signature-requests/history",
  authenticate,
  asyncHandler(getMySignatureHistory)
);

// Fetch one signature request (with HTML snapshot) for the signing UI.
mySignatureRoutes.get(
  "/signature-requests/:requestId",
  authenticate,
  requestIdParamValidator,
  validateRequest,
  asyncHandler(getMySignatureRequest)
);

// Submit signature for one request.
mySignatureRoutes.post(
  "/signature-requests/:requestId/sign",
  authenticate,
  submitSignatureValidator,
  validateRequest,
  asyncHandler(postSignature)
);
