import { Router } from "express";

import {
  getAdminCaseDetailHandler,
  getCommissionRateHandler,
  getDashboardStatsHandler,
  getMoneyOverviewHandler,
  getPayoutReceiptHandler,
  getRecentActivityHandler,
  listAdminCasesHandler,
  listPayoutsHandler,
  markPayoutPaidHandler,
  updateCommissionRateHandler,
  updatePayoutHandler
} from "./admin.controller.js";
import {
  adminCaseIdParamValidator,
  listAdminCasesValidator,
  listPayoutsValidator,
  markPayoutPaidValidator,
  updateCommissionRateValidator,
  updatePayoutValidator
} from "./admin.validators.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { uploadPayoutReceipt } from "../../middleware/uploadPayoutReceipt.js";
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

// Platform money overview for the Finances page (admin-only).
router.get("/money-overview", asyncHandler(getMoneyOverviewHandler));

// Platform commission rate — view + update (admin-only).
router.get("/commission-rate", asyncHandler(getCommissionRateHandler));
router.put(
  "/commission-rate",
  updateCommissionRateValidator,
  validateRequest,
  asyncHandler(updateCommissionRateHandler)
);

// Payouts queue + processing (admin-only, gated by the router.use above).
router.get(
  "/payouts",
  listPayoutsValidator,
  validateRequest,
  asyncHandler(listPayoutsHandler)
);
router.patch(
  "/payouts/:payoutId",
  updatePayoutValidator,
  validateRequest,
  asyncHandler(updatePayoutHandler)
);
// Mark paid WITH transfer proof — multer parses the multipart body first so the
// validators can see the text fields; the receipt file is checked in the handler.
router.post(
  "/payouts/:payoutId/mark-paid",
  uploadPayoutReceipt,
  markPayoutPaidValidator,
  validateRequest,
  asyncHandler(markPayoutPaidHandler)
);
router.get(
  "/payouts/:payoutId/receipt",
  asyncHandler(getPayoutReceiptHandler)
);

export default router;
