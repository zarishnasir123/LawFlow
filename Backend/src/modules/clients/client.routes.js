import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";

import { listMyCases } from "./client.controller.js";

const router = Router();

// Client-facing, read-only list of the caller's own cases + their status.
// Gated to role 'client'; ownership (cases.client_user_id = req.user.sub) is
// enforced in SQL inside the service. High-level status only — no review
// remarks, signed PDF, edited HTML, or attachments are exposed here.
router.get(
  "/cases",
  authenticate,
  authorizeRoles("client"),
  asyncHandler(listMyCases)
);

export default router;
