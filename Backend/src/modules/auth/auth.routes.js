import { Router } from "express";

import {
  login,
  logout,
  me,
  refresh,
  registerClient,
  registerLawyer,
  resendVerificationOtp,
  verifyEmail
} from "./auth.controller.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import {
  loginValidator,
  registerClientValidator,
  resendVerificationOtpValidator,
  verifyEmailValidator
} from "./auth.validators.js";

const router = Router();

router.post(
  "/register/client",
  registerClientValidator,
  validateRequest,
  asyncHandler(registerClient)
);
router.post("/register/lawyer", registerLawyer);
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
router.post("/logout", asyncHandler(logout));
router.get("/me", authenticate, asyncHandler(me));

export default router;
