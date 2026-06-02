import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import {
  confirmCheckoutSession,
  createCheckoutSession,
} from "./stripe.controller.js";

const router = Router();

router.post(
  "/create-checkout-session",
  authenticate,
  authorizeRoles("client"),
  asyncHandler(createCheckoutSession)
);

router.post(
  "/confirm-checkout-session",
  authenticate,
  authorizeRoles("client"),
  asyncHandler(confirmCheckoutSession)
);

export default router;

