import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import {
  createAgreementHandler,
  createPaymentPlanHandler,
  getAgreementHandler,
  getAgreementsByCaseHandler,
  getLawyerCaseAgreementContextHandler,
  getReceiptHandler,
  listClientAgreementsHandler,
  listLawyerAgreementCasesHandler,
  listLawyerEarningsHandler,
  listReceiptsHandler,
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
