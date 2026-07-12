import {
  submitReview,
  deleteMyReview,
  getLawyerReviews,
  getReceivedReviews,
  reportReview,
} from "./reviews.service.js";

// req.user.sub = caller user id, req.user.role = caller role (from the JWT).

// POST /api/reviews  (client) -> { review }
export async function postReview(req, res) {
  const result = await submitReview({
    clientUserId: req.user.sub,
    lawyerProfileId: req.body.lawyerProfileId,
    rating: Number(req.body.rating),
    comment: req.body.comment,
  });
  return res.status(201).json(result);
}

// DELETE /api/reviews/:reviewId  (client, own only) -> { deleted: true }
export async function deleteReview(req, res) {
  const result = await deleteMyReview({
    clientUserId: req.user.sub,
    reviewId: req.params.reviewId,
  });
  return res.status(200).json(result);
}

// GET /api/reviews/lawyer/:lawyerProfileId -> { summary, reviews, myReview, canReview }
export async function listLawyerReviews(req, res) {
  const result = await getLawyerReviews({
    lawyerProfileId: req.params.lawyerProfileId,
    callerUserId: req.user.sub,
    callerRole: req.user.role,
  });
  return res.status(200).json(result);
}

// GET /api/reviews/received  (lawyer) -> { summary, reviews }
export async function listReceivedReviews(req, res) {
  const result = await getReceivedReviews({ lawyerUserId: req.user.sub });
  return res.status(200).json(result);
}

// POST /api/reviews/:reviewId/report  (lawyer, own reviews) -> { reported: true }
export async function postReport(req, res) {
  const result = await reportReview({
    lawyerUserId: req.user.sub,
    reviewId: req.params.reviewId,
    reason: req.body?.reason,
  });
  return res.status(200).json(result);
}
