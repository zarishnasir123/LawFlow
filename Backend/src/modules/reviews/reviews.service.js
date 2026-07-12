import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import { getUserAvatarSignedUrl } from "../../services/storage.service.js";
import { createNotification } from "../notifications/notifications.service.js";

// =====================================================================
// Lawyer reviews — a client rates + reviews a lawyer they've worked with.
//
// Eligibility: the client must have a case with that lawyer that's been
// submitted to the registrar (cases.status <> 'draft'). One review per
// (client, lawyer) — a re-submit edits it. A lawyer may REPORT a review of them
// (it stays visible until an admin acts); an admin can then hide the review,
// dismiss the report, or BLOCK the client who posted it. Public reads + all
// rating aggregates exclude status='hidden'.
// =====================================================================

function fullName(first, last, fallback = "Client") {
  const name = `${first || ""} ${last || ""}`.trim();
  return name || fallback;
}

function initialsFor(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Resolve a public lawyer_profiles.id to the lawyer's user_id, ensuring it's an
// approved, active lawyer (same visibility rule as the directory). 404 otherwise.
async function resolveApprovedLawyer(lawyerProfileId) {
  const { rows } = await pool.query(
    `SELECT lp.id, lp.user_id
       FROM lawyer_profiles lp
       JOIN users u ON u.id = lp.user_id
      WHERE lp.id = $1
        AND lp.verification_status = 'approved'
        AND u.account_status = 'active'
        AND u.deactivated_at IS NULL`,
    [lawyerProfileId]
  );
  if (rows.length === 0) throw new ApiError(404, "Lawyer not found");
  return rows[0];
}

// Has this client engaged this lawyer on a real (submitted-or-further) case?
async function clientHasSubmittedCaseWith(clientUserId, lawyerUserId) {
  const { rows } = await pool.query(
    `SELECT EXISTS(
       SELECT 1 FROM cases
        WHERE client_user_id = $1 AND lawyer_user_id = $2 AND status <> 'draft'
     ) AS ok`,
    [clientUserId, lawyerUserId]
  );
  return Boolean(rows[0]?.ok);
}

// Average / count / 5→1 distribution, excluding admin-hidden reviews.
async function buildSummary(lawyerProfileId) {
  const { rows } = await pool.query(
    `SELECT
        COUNT(*)::int AS count,
        ROUND(AVG(rating)::numeric, 1) AS average,
        COUNT(*) FILTER (WHERE rating = 5)::int AS r5,
        COUNT(*) FILTER (WHERE rating = 4)::int AS r4,
        COUNT(*) FILTER (WHERE rating = 3)::int AS r3,
        COUNT(*) FILTER (WHERE rating = 2)::int AS r2,
        COUNT(*) FILTER (WHERE rating = 1)::int AS r1
       FROM lawyer_reviews
      WHERE lawyer_profile_id = $1 AND status <> 'hidden'`,
    [lawyerProfileId]
  );
  const s = rows[0] || {};
  return {
    count: Number(s.count) || 0,
    average:
      s.average !== null && s.average !== undefined ? Number(s.average) : null,
    distribution: {
      5: Number(s.r5) || 0,
      4: Number(s.r4) || 0,
      3: Number(s.r3) || 0,
      2: Number(s.r2) || 0,
      1: Number(s.r1) || 0,
    },
  };
}

async function mapReviewRow(row, callerUserId) {
  const name = fullName(row.first_name, row.last_name, "Client");
  return {
    id: row.id,
    rating: Number(row.rating),
    comment: row.comment || null,
    status: row.status,
    createdAt: row.created_at,
    isMine: Boolean(callerUserId) && row.client_user_id === callerUserId,
    reviewer: {
      name,
      initials: initialsFor(name),
      avatarUrl: row.avatar_storage_path
        ? await getUserAvatarSignedUrl(row.avatar_storage_path)
        : null,
    },
  };
}

// Client submits or edits their single review of a lawyer.
export async function submitReview({ clientUserId, lawyerProfileId, rating, comment }) {
  const lawyer = await resolveApprovedLawyer(lawyerProfileId);
  if (lawyer.user_id === clientUserId) {
    throw new ApiError(400, "You cannot review yourself.");
  }

  const eligible = await clientHasSubmittedCaseWith(clientUserId, lawyer.user_id);
  if (!eligible) {
    throw new ApiError(
      403,
      "You can review a lawyer only after you have a submitted case with them."
    );
  }

  const text = String(comment || "").trim();

  const { rows } = await pool.query(
    `INSERT INTO lawyer_reviews (lawyer_profile_id, client_user_id, rating, comment, status)
     VALUES ($1, $2, $3, $4, 'visible')
     ON CONFLICT (lawyer_profile_id, client_user_id)
       DO UPDATE SET rating       = EXCLUDED.rating,
                     comment      = EXCLUDED.comment,
                     status       = 'visible',
                     report_reason = NULL,
                     reported_at  = NULL,
                     updated_at   = NOW()
     RETURNING id, rating, comment, status, created_at`,
    [lawyerProfileId, clientUserId, rating, text || null]
  );

  // Best-effort: tell the lawyer they got a review.
  try {
    await createNotification({
      userId: lawyer.user_id,
      type: "review_received",
      title: "New review",
      message: `A client left you a ${rating}-star review.`,
    });
  } catch (err) {
    console.error("[reviews] notify failed:", err?.message);
  }

  return { review: rows[0] };
}

export async function deleteMyReview({ clientUserId, reviewId }) {
  const { rowCount } = await pool.query(
    `DELETE FROM lawyer_reviews WHERE id = $1 AND client_user_id = $2`,
    [reviewId, clientUserId]
  );
  if (rowCount === 0) throw new ApiError(404, "Review not found.");
  return { deleted: true };
}

// Powers the public lawyer profile: summary + review list (+ the caller's own
// review and whether they're allowed to write one, when the caller is a client).
export async function getLawyerReviews({ lawyerProfileId, callerUserId, callerRole }) {
  const lawyer = await resolveApprovedLawyer(lawyerProfileId);
  const summary = await buildSummary(lawyerProfileId);

  const { rows } = await pool.query(
    `SELECT r.id, r.rating, r.comment, r.status, r.created_at, r.client_user_id,
            u.first_name, u.last_name, u.avatar_storage_path
       FROM lawyer_reviews r
       JOIN users u ON u.id = r.client_user_id
      WHERE r.lawyer_profile_id = $1 AND r.status <> 'hidden'
      ORDER BY r.created_at DESC`,
    [lawyerProfileId]
  );
  const reviews = await Promise.all(rows.map((row) => mapReviewRow(row, callerUserId)));

  let myReview = null;
  let canReview = false;
  if (callerRole === "client" && callerUserId !== lawyer.user_id) {
    const mine = await pool.query(
      `SELECT id, rating, comment, status, created_at
         FROM lawyer_reviews
        WHERE lawyer_profile_id = $1 AND client_user_id = $2`,
      [lawyerProfileId, callerUserId]
    );
    if (mine.rows[0]) {
      const m = mine.rows[0];
      myReview = {
        id: m.id,
        rating: Number(m.rating),
        comment: m.comment || null,
        status: m.status,
        createdAt: m.created_at,
      };
    }
    canReview = await clientHasSubmittedCaseWith(callerUserId, lawyer.user_id);
  }

  return { summary, reviews, myReview, canReview };
}

// The caller lawyer's own received reviews + summary (for their profile page).
export async function getReceivedReviews({ lawyerUserId }) {
  const prof = await pool.query(
    `SELECT id FROM lawyer_profiles WHERE user_id = $1`,
    [lawyerUserId]
  );
  if (prof.rows.length === 0) throw new ApiError(404, "Lawyer profile not found.");
  const lawyerProfileId = prof.rows[0].id;

  const summary = await buildSummary(lawyerProfileId);
  const { rows } = await pool.query(
    `SELECT r.id, r.rating, r.comment, r.status, r.created_at, r.client_user_id,
            u.first_name, u.last_name, u.avatar_storage_path
       FROM lawyer_reviews r
       JOIN users u ON u.id = r.client_user_id
      WHERE r.lawyer_profile_id = $1 AND r.status <> 'hidden'
      ORDER BY r.created_at DESC`,
    [lawyerProfileId]
  );
  const reviews = await Promise.all(rows.map((row) => mapReviewRow(row, null)));
  return { summary, reviews };
}

// A reviewed lawyer flags a review of them for admin attention. It stays visible.
export async function reportReview({ lawyerUserId, reviewId, reason }) {
  const { rows } = await pool.query(
    `SELECT r.id, r.status, lp.user_id AS lawyer_user_id
       FROM lawyer_reviews r
       JOIN lawyer_profiles lp ON lp.id = r.lawyer_profile_id
      WHERE r.id = $1`,
    [reviewId]
  );
  const rev = rows[0];
  if (!rev) throw new ApiError(404, "Review not found.");
  if (rev.lawyer_user_id !== lawyerUserId) {
    throw new ApiError(403, "You can only report reviews written about you.");
  }
  if (rev.status === "hidden") {
    throw new ApiError(422, "This review has already been removed.");
  }

  await pool.query(
    `UPDATE lawyer_reviews
        SET status = 'reported', report_reason = $2, reported_at = NOW(), updated_at = NOW()
      WHERE id = $1`,
    [reviewId, String(reason || "").trim() || null]
  );
  return { reported: true };
}
