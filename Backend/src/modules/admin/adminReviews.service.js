import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";

// Admin review moderation. The reported queue (a lawyer flagged a review of
// them), plus hide / dismiss actions. Hiding removes the review from public
// reads and every rating aggregate; dismissing clears the report and restores
// the review to normal visibility.

export async function listReportedReviews({ status = "reported" } = {}) {
  const wanted = ["reported", "hidden", "visible"].includes(status)
    ? status
    : "reported";

  const { rows } = await pool.query(
    `SELECT r.id, r.rating, r.comment, r.status, r.report_reason, r.reported_at, r.created_at,
            TRIM(lu.first_name || ' ' || lu.last_name) AS lawyer_name,
            TRIM(cu.first_name || ' ' || cu.last_name) AS client_name
       FROM lawyer_reviews r
       JOIN lawyer_profiles lp ON lp.id = r.lawyer_profile_id
       JOIN users lu ON lu.id = lp.user_id
       JOIN users cu ON cu.id = r.client_user_id
      WHERE r.status = $1
      ORDER BY r.reported_at DESC NULLS LAST, r.created_at DESC`,
    [wanted]
  );

  return {
    reviews: rows.map((r) => ({
      id: r.id,
      rating: Number(r.rating),
      comment: r.comment || null,
      status: r.status,
      reportReason: r.report_reason || null,
      reportedAt: r.reported_at,
      createdAt: r.created_at,
      lawyerName: (r.lawyer_name || "").trim() || "Advocate",
      clientName: (r.client_name || "").trim() || "Client",
    })),
  };
}

export async function hideReview({ reviewId, adminUserId }) {
  const { rowCount } = await pool.query(
    `UPDATE lawyer_reviews
        SET status = 'hidden', moderated_by_user_id = $2, updated_at = NOW()
      WHERE id = $1`,
    [reviewId, adminUserId]
  );
  if (rowCount === 0) throw new ApiError(404, "Review not found.");
  return { hidden: true };
}

export async function dismissReport({ reviewId, adminUserId }) {
  const { rowCount } = await pool.query(
    `UPDATE lawyer_reviews
        SET status = 'visible', report_reason = NULL, reported_at = NULL,
            moderated_by_user_id = $2, updated_at = NOW()
      WHERE id = $1`,
    [reviewId, adminUserId]
  );
  if (rowCount === 0) throw new ApiError(404, "Review not found.");
  return { dismissed: true };
}

// Block the CLIENT who posted a hateful/abusive review: suspend their account so
// they can no longer sign in or post, and hide the offending review. Used for the
// "someone posted hate comments on a lawyer" case.
export async function blockReviewAuthor({ reviewId, adminUserId }) {
  const { rows } = await pool.query(
    `SELECT client_user_id FROM lawyer_reviews WHERE id = $1`,
    [reviewId]
  );
  const rev = rows[0];
  if (!rev) throw new ApiError(404, "Review not found.");

  await pool.query(
    `UPDATE users
        SET account_status = 'suspended', updated_at = NOW()
      WHERE id = $1 AND account_status <> 'suspended'`,
    [rev.client_user_id]
  );
  await pool.query(
    `UPDATE lawyer_reviews
        SET status = 'hidden', moderated_by_user_id = $2, updated_at = NOW()
      WHERE id = $1`,
    [reviewId, adminUserId]
  );
  return { blocked: true };
}
