import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { validateRequest } from "../../middleware/validateRequest.js";

import {
  deleteSignatureRequest,
  getCaseSignatureRequests,
  getPublicSigningRequest,
  postClientSignature,
  postSignatureRequest,
  putEditedDocument,
} from "./signatures.controller.js";
import {
  caseIdParamValidator,
  createSignatureRequestValidator,
  requestIdParamValidator,
  saveEditedDocumentValidator,
  submitSignatureValidator,
  tokenParamValidator,
} from "./signatures.validators.js";

// Two separate routers because the public signing endpoints sit on a
// different mount point (`/api/signing`) so they can't accidentally
// inherit the lawyer auth middleware from the case-scoped routes.
export const caseSignatureRoutes = Router({ mergeParams: true });

// Lawyer saves the current edited HTML state of a case document.
caseSignatureRoutes.put(
  "/document",
  authenticate,
  authorizeRoles("lawyer"),
  saveEditedDocumentValidator,
  validateRequest,
  asyncHandler(putEditedDocument)
);

// Lawyer lists all signature requests on a case (poll target).
caseSignatureRoutes.get(
  "/signature-requests",
  authenticate,
  authorizeRoles("lawyer"),
  caseIdParamValidator,
  validateRequest,
  asyncHandler(getCaseSignatureRequests)
);

// Lawyer creates a new signature request.
caseSignatureRoutes.post(
  "/signature-requests",
  authenticate,
  authorizeRoles("lawyer"),
  createSignatureRequestValidator,
  validateRequest,
  asyncHandler(postSignatureRequest)
);

// Lawyer cancels a specific signature request. Nested under
// /cases/:caseId so ownership can be checked through the join.
caseSignatureRoutes.delete(
  "/signature-requests/:requestId",
  authenticate,
  authorizeRoles("lawyer"),
  requestIdParamValidator,
  validateRequest,
  asyncHandler(deleteSignatureRequest)
);

// ──────────────────────────────────────────────────────────────────────
// Public signing endpoints. No authenticate middleware — the URL token
// IS the auth: it's a 256-bit random secret that only exists in the
// email body and the recipient's URL bar. Both validators are still
// in front of the controllers so malformed tokens return 400/404 fast.
// ──────────────────────────────────────────────────────────────────────
export const publicSigningRoutes = Router();

publicSigningRoutes.get(
  "/:token",
  tokenParamValidator,
  validateRequest,
  asyncHandler(getPublicSigningRequest)
);

publicSigningRoutes.post(
  "/:token/sign",
  submitSignatureValidator,
  validateRequest,
  asyncHandler(postClientSignature)
);
