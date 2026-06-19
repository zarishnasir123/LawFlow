import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import {
  createAgreementHandler,
  createPaymentPlanHandler,
  removePaymentPlanHandler,
  getAgreementHandler,
  getAgreementsByCaseHandler,
  getLawyerCaseAgreementContextHandler,
  getLawyerPayoutAccountHandler,
  getReceiptHandler,
  listClientAgreementsHandler,
  listLawyerAgreementCasesHandler,
  listLawyerEarningsHandler,
  listLawyerPayoutsHandler,
  listReceiptsHandler,
  requestPayoutHandler,
  updateLawyerPayoutAccountHandler,
  listTransactionsHandler,
  updateAgreementStatusHandler,
} from "./agreements.controller.js";
import {
  caseIdParamValidator,
  createAgreementValidator,
  createPaymentPlanValidator,
  getAgreementValidator,
  optionalCaseIdQueryValidator,
  receiptIdValidator,
  updateAgreementValidator,
} from "./agreements.validators.js";

const router = Router();

router.post(
  "/agreements",
  authenticate,
  authorizeRoles("lawyer"),
  createAgreementValidator,
  validateRequest,
  asyncHandler(createAgreementHandler)
);

router.get(
  "/agreements/:agreementId",
  authenticate,
  getAgreementValidator,
  validateRequest,
  asyncHandler(getAgreementHandler)
);

router.get(
  "/lawyer/agreement-cases",
  authenticate,
  authorizeRoles("lawyer"),
  asyncHandler(listLawyerAgreementCasesHandler)
);

router.get(
  "/lawyer/earnings",
  authenticate,
  authorizeRoles("lawyer"),
  asyncHandler(listLawyerEarningsHandler)
);

router.get(
  "/lawyer/payout-account",
  authenticate,
  authorizeRoles("lawyer"),
  asyncHandler(getLawyerPayoutAccountHandler)
);

router.put(
  "/lawyer/payout-account",
  authenticate,
  authorizeRoles("lawyer"),
  asyncHandler(updateLawyerPayoutAccountHandler)
);

// Lawyer withdraws their available balance: create a payout request, then list
// their payout history. Admin processes the request (see admin module).
router.post(
  "/lawyer/request-payout",
  authenticate,
  authorizeRoles("lawyer"),
  asyncHandler(requestPayoutHandler)
);

router.get(
  "/lawyer/payouts",
  authenticate,
  authorizeRoles("lawyer"),
  asyncHandler(listLawyerPayoutsHandler)
);

router.get(
  "/lawyer/cases/:caseId/agreement-context",
  authenticate,
  authorizeRoles("lawyer"),
  caseIdParamValidator,
  validateRequest,
  asyncHandler(getLawyerCaseAgreementContextHandler)
);

router.post(
  "/lawyer/cases/:caseId/payment-plan",
  authenticate,
  authorizeRoles("lawyer"),
  createPaymentPlanValidator,
  validateRequest,
  asyncHandler(createPaymentPlanHandler)
);

// Remove a case's payment plan (only when nothing has been paid) so the lawyer
// can then delete the case.
router.delete(
  "/lawyer/cases/:caseId/payment-plan",
  authenticate,
  authorizeRoles("lawyer"),
  caseIdParamValidator,
  validateRequest,
  asyncHandler(removePaymentPlanHandler)
);

router.get(
  "/client/agreements",
  authenticate,
  authorizeRoles("client"),
  asyncHandler(listClientAgreementsHandler)
);

router.get(
  "/case/:caseId/agreements",
  authenticate,
  caseIdParamValidator,
  validateRequest,
  asyncHandler(getAgreementsByCaseHandler)
);

router.get(
  "/transactions",
  authenticate,
  optionalCaseIdQueryValidator,
  validateRequest,
  asyncHandler(listTransactionsHandler)
);

router.get(
  "/receipts",
  authenticate,
  optionalCaseIdQueryValidator,
  validateRequest,
  asyncHandler(listReceiptsHandler)
);

router.get(
  "/receipts/:receiptId",
  authenticate,
  receiptIdValidator,
  validateRequest,
  asyncHandler(getReceiptHandler)
);

router.patch(
  "/agreements/:agreementId",
  authenticate,
  updateAgreementValidator,
  validateRequest,
  asyncHandler(updateAgreementStatusHandler)
);

export default router;
