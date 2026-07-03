import { Router } from "express";
import {
  changePassword,
  deactivateMe,
  deleteMyAvatar,
  googleLogin,
  reactivate,
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
  updateMe,
  updateMyAvatar,
  verifyEmail,
  verifyLawyerCnic
} from "./auth.controller.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { uploadAvatar } from "../../middleware/uploadAvatar.js";
import { uploadLawyerDocs } from "../../middleware/uploadLawyerDocs.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import {
  forgotPasswordLimiter,
  lawyerReviewLimiter,
  loginLimiter,
  otpResendLimiter,
  registerLimiter,
  resetPasswordLimiter,
  aiGuidanceLimiter
} from "../../middleware/rateLimiter.js";
import {
  changePasswordValidator,
  listLawyerRejectionHistoryValidator,
  listPendingLawyersValidator,
  loginValidator,
  registerClientValidator,
  registerLawyerValidator,
  resendVerificationOtpValidator,
  reviewLawyerValidator,
  suspendLawyerValidator,
  updateMyProfileValidator,
  verifyEmailValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  verifyCnicValidator
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
  "/lawyers/:lawyerProfileId/verify-cnic",
  authenticate,
  authorizeRoles("admin"),
  aiGuidanceLimiter,
  verifyCnicValidator,
  validateRequest,
  asyncHandler(verifyLawyerCnic)
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
// Second leg of the deactivation-recovery flow. Takes the short-
// lived reactivationToken minted by /login or /google/session,
// finalizes the reactivation, and returns a normal session in the
// same shape as /login. No auth middleware: the token itself proves
// identity (login already verified the password / OAuth handshake).
router.post("/reactivate", asyncHandler(reactivate));
router.post(
  "/change-password",
  authenticate,
  resetPasswordLimiter,
  changePasswordValidator,
  validateRequest,
  asyncHandler(changePassword)
);
router.get("/me", authenticate, asyncHandler(me));
router.patch(
  "/me",
  authenticate,
  updateMyProfileValidator,
  validateRequest,
  asyncHandler(updateMe)
);
router.post(
  "/me/avatar",
  authenticate,
  uploadAvatar,
  asyncHandler(updateMyAvatar)
);
router.delete("/me/avatar", authenticate, asyncHandler(deleteMyAvatar));
// Self-service deactivation. No validator: there's no body. The
// `authenticate` middleware proves the caller owns the account.
router.delete("/me", authenticate, asyncHandler(deactivateMe));
router.get("/google", asyncHandler(googleLogin));
router.post("/google/session", asyncHandler(googleSession));
router.post("/webhooks/supabase", asyncHandler(supabaseAuthWebhook));

export default router;
