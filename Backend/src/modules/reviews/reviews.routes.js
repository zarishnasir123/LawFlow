import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { validateRequest } from "../../middleware/validateRequest.js";

import {
  postReview,
  deleteReview,
  listLawyerReviews,
  listReceivedReviews,
  postReport,
} from "./reviews.controller.js";
import {
  submitReviewValidator,
  lawyerProfileIdParamValidator,
  reviewIdParamValidator,
  reportReviewValidator,
} from "./reviews.validators.js";

const router = Router();

// Any logged-in user may read a lawyer's reviews; writes are role-gated per route.
router.use(authenticate);

// Client submits / edits their single review (auto-moderated in the service).
router.post(
  "/",
  authorizeRoles("client"),
  submitReviewValidator,
  validateRequest,
  asyncHandler(postReview)
);

// Lawyer's own received reviews (self-view). Literal path before the :param routes.
router.get(
  "/received",
  authorizeRoles("lawyer"),
  asyncHandler(listReceivedReviews)
);

// Public (any authed role): a lawyer's reviews + summary for their profile.
router.get(
  "/lawyer/:lawyerProfileId",
  lawyerProfileIdParamValidator,
  validateRequest,
  asyncHandler(listLawyerReviews)
);

// Client deletes their own review.
router.delete(
  "/:reviewId",
  authorizeRoles("client"),
  reviewIdParamValidator,
  validateRequest,
  asyncHandler(deleteReview)
);

// Reviewed lawyer reports a review of them → admin queue (stays visible).
router.post(
  "/:reviewId/report",
  authorizeRoles("lawyer"),
  reportReviewValidator,
  validateRequest,
  asyncHandler(postReport)
);

export default router;
