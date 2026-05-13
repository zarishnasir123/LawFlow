import { Router } from "express";
import {
  googleLogin,
  googleSession,
  forgotPassword,
  listPendingLawyers,
  login,
  logout,
  me,
  refresh,
  registerClient,
  registerLawyer,
  resendVerificationOtp,
  resetPassword,
  reviewLawyer,
  supabaseAuthWebhook,
  verifyEmail
} from "./auth.controller.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { uploadLawyerDocs } from "../../middleware/uploadLawyerDocs.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import {
  listPendingLawyersValidator,
  loginValidator,
  registerClientValidator,
  registerLawyerValidator,
  resendVerificationOtpValidator,
  reviewLawyerValidator,
  verifyEmailValidator,
  forgotPasswordValidator,
  resetPasswordValidator
} from "./auth.validators.js";

const router = Router();

router.post(
  "/register/client",
  registerClientValidator,
  validateRequest,
  asyncHandler(registerClient)
);

router.post(
  "/register/lawyer",
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

router.patch(
  "/lawyers/:lawyerProfileId/review",
  authenticate,
  authorizeRoles("admin"),
  reviewLawyerValidator,
  validateRequest,
  asyncHandler(reviewLawyer)
);

router.post(
  "/login",
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
  resendVerificationOtpValidator,
  validateRequest,
  asyncHandler(resendVerificationOtp)
);
router.post(
  "/forgot-password",
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per window
    message: "Too many password reset requests from this IP. Please try again after 15 minutes."
  }),
  forgotPasswordValidator,
  validateRequest,
  asyncHandler(forgotPassword)
);
router.post(
  "/reset-password",
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
