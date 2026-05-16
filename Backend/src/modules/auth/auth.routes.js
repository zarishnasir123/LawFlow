import { Router } from "express";
import {
  googleLogin,
  googleSession,
  forgotPassword,
  listActiveLawyers,
  listLawyerRejections,
  listPendingLawyers,
  login,
  logout,
  me,
  refresh,
  registerClient,
  registerLawyer,
  reinstateLawyer,
  resendVerificationOtp,
  resetPassword,
  reviewLawyer,
  suspendLawyer,
  supabaseAuthWebhook,
  verifyEmail
} from "./auth.controller.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { uploadLawyerDocs } from "../../middleware/uploadLawyerDocs.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import {
  forgotPasswordLimiter,
  lawyerReviewLimiter,
  loginLimiter,
  otpResendLimiter,
  registerLimiter,
  resetPasswordLimiter
} from "../../middleware/rateLimiter.js";
import {
  listLawyerRejectionHistoryValidator,
  listPendingLawyersValidator,
  loginValidator,
  registerClientValidator,
  registerLawyerValidator,
  resendVerificationOtpValidator,
  reviewLawyerValidator,
  suspendLawyerValidator,
  verifyEmailValidator,
  forgotPasswordValidator,
  resetPasswordValidator
} from "./auth.validators.js";

const router = Router();

router.post(
  "/register/client",
  registerLimiter,
  registerClientValidator,
  validateRequest,
  asyncHandler(registerClient)
);

router.post(
  "/register/lawyer",
  registerLimiter,
  uploadLawyerDocs,
  registerLawyerValidator,
  validateRequest,
  asyncHandler(registerLawyer)
);

router.get(
  "/lawyers/pending",
  authenticate,
  authorizeRoles("admin"),
  listPendingLawyersValidator,
  validateRequest,
  asyncHandler(listPendingLawyers)
);

router.get(
  "/lawyers/active",
  authenticate,
  authorizeRoles("admin"),
  listPendingLawyersValidator,
  validateRequest,
  asyncHandler(listActiveLawyers)
);

router.get(
  "/lawyers/rejections",
  authenticate,
  authorizeRoles("admin"),
  listLawyerRejectionHistoryValidator,
  validateRequest,
  asyncHandler(listLawyerRejections)
);

router.patch(
  "/lawyers/:lawyerProfileId/review",
  authenticate,
  authorizeRoles("admin"),
  lawyerReviewLimiter,
  reviewLawyerValidator,
  validateRequest,
  asyncHandler(reviewLawyer)
);

router.patch(
  "/lawyers/:lawyerProfileId/suspend",
  authenticate,
  authorizeRoles("admin"),
  lawyerReviewLimiter,
  suspendLawyerValidator,
  validateRequest,
  asyncHandler(suspendLawyer)
);

router.patch(
  "/lawyers/:lawyerProfileId/reinstate",
  authenticate,
  authorizeRoles("admin"),
  lawyerReviewLimiter,
  asyncHandler(reinstateLawyer)
);

router.post(
  "/login",
  loginLimiter,
  loginValidator,
  validateRequest,
  asyncHandler(login)
);
router.post("/refresh", asyncHandler(refresh));
router.post(
  "/verify-email",
  verifyEmailValidator,
  validateRequest,
  asyncHandler(verifyEmail)
);
router.post(
  "/resend-verification-otp",
  otpResendLimiter,
  resendVerificationOtpValidator,
  validateRequest,
  asyncHandler(resendVerificationOtp)
);
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  forgotPasswordValidator,
  validateRequest,
  asyncHandler(forgotPassword)
);
router.post(
  "/reset-password",
  resetPasswordLimiter,
  resetPasswordValidator,
  validateRequest,
  asyncHandler(resetPassword)
);
router.post("/logout", asyncHandler(logout));
router.get("/me", authenticate, asyncHandler(me));
router.get("/google", asyncHandler(googleLogin));
router.post("/google/session", asyncHandler(googleSession));
router.post("/webhooks/supabase", asyncHandler(supabaseAuthWebhook));

export default router;
