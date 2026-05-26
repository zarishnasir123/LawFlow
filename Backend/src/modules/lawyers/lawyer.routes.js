import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { listLawyers } from "./lawyer.controller.js";
import { listLawyersValidator } from "./lawyer.validators.js";

const router = Router();

// Public-facing lawyer directory used by the client's Find-a-Lawyer
// page. Returns only approved + active lawyers, sanitized to non-
// sensitive fields (no CNIC, phone, documents, or audit metadata).
// Authentication is required — we never serve the directory to
// anonymous callers — but no role gate, because lawyers and admins
// may also legitimately browse it.
router.get(
  "/",
  authenticate,
  listLawyersValidator,
  validateRequest,
  asyncHandler(listLawyers)
);

export default router;
