import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import {
  confirmPayment,
  createCheckoutSession,
  handleSafepayCancel,
  handleSafepayReturn,
  handleSafepayWebhook,
} from "./payments.controller.js";

const router = Router();

// Client starts a payment for one installment.
router.post(
  "/create-checkout-session",
  authenticate,
  authorizeRoles("client"),
  asyncHandler(createCheckoutSession)
);

// The SPA calls this right after Safepay redirects the browser back to the app
// with the signed tracker + sig. Verifies the signature and records the payment.
// No auth — trust is the Safepay signature, like the return/webhook paths.
router.post("/confirm", asyncHandler(confirmPayment));

// Safepay redirects the browser back here after the user pays or cancels. No
// auth middleware — the request is trusted via Safepay's signature, not the
// user's session (a top-level browser redirect doesn't carry the JWT). Safepay
// may use GET or POST, so accept both.
router.all("/safepay/return", asyncHandler(handleSafepayReturn));
router.all("/safepay/cancel", asyncHandler(handleSafepayCancel));

// Safepay server-to-server webhook (safety net). Signature is verified inside
// the handler against the normal parsed JSON body.
router.post("/webhook", asyncHandler(handleSafepayWebhook));

export default router;
