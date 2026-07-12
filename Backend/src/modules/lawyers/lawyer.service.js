import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import { getUserAvatarSignedUrl } from "../../services/storage.service.js";

// Convert a Postgres row into the public lawyer-directory shape the
// frontend renders. Sensitive fields (CNIC, phone, documents, bar
// license number, verification audit) are deliberately absent — this
// payload goes to any authenticated user, so we only expose what a
// client genuinely needs to make a hiring decision.
async function mapDirectoryLawyer(row) {
  const signed = row.avatar_storage_path
    ? await getUserAvatarSignedUrl(row.avatar_storage_path)
    : null;

  // ?v=<updated_at-ms> cache-buster mirrors the /auth/me pattern so
  // a freshly-uploaded avatar shows up immediately even within the
  // signed URL's 1-hour TTL.
  const avatarUrl = signed
    ? `${signed}${signed.includes("?") ? "&" : "?"}v=${
        row.updated_at ? new Date(row.updated_at).getTime() : Date.now()
      }`
    : null;

  return {
    lawyerProfileId: row.lawyer_profile_id,
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl,
    specialization: row.specialization,
    districtBar: row.district_bar,
    experienceYears:
      row.experience_years !== null && row.experience_years !== undefined
        ? Number(row.experience_years)
        : null,
    // Bio is included on both list and detail so the directory card
    // can show a preview snippet later if the design calls for one.
    // Null when the lawyer hasn't filled it in yet.
    bio: row.bio || null,
    // Rating aggregates (LEFT JOIN LATERAL over lawyer_reviews, hidden excluded).
    // averageRating is null when the lawyer has no reviews yet.
    averageRating:
      row.avg_rating !== null && row.avg_rating !== undefined
        ? Number(row.avg_rating)
        : null,
    reviewCount:
      row.review_count !== null && row.review_count !== undefined
        ? Number(row.review_count)
        : 0,
  };
}

// Normalise the search keyword into the same lowercase form ILIKE
// will use. Returns null when the keyword is empty so the WHERE
// clause can skip the predicate entirely.
function buildSearchPattern(keyword) {
  if (typeof keyword !== "string") return null;
  const trimmed = keyword.trim();
  if (!trimmed) return null;
  return `%${trimmed}%`;
}

// Normalise the specialization filter. "all" or empty → no filter;
// "civil"/"Civil" → "Civil"; "family"/"Family" → "Family". Anything
// else returns null (validator rejected it upstream, so this is a
// belt-and-braces guard).
function normalizeSpecialization(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "all") return null;
  const lower = trimmed.toLowerCase();
  if (lower === "civil") return "Civil";
  if (lower === "family") return "Family";
  return null;
}

// GET /api/lawyers — list of approved, active lawyers visible to the
// client directory. Suspended (account_status='suspended'), pending,
// rejected, and self-deactivated (deactivated_at IS NOT NULL) lawyers
// are excluded.
export async function listApprovedLawyers({
  search = "",
  specialization = null,
  limit = 20,
  offset = 0,
} = {}) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
  const safeOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);
  const searchPattern = buildSearchPattern(search);
  const normalizedSpec = normalizeSpecialization(specialization);

  const result = await pool.query(
    `SELECT
      lawyer_profiles.id AS lawyer_profile_id,
      users.id AS user_id,
      users.first_name,
      users.last_name,
      users.avatar_storage_path,
      users.updated_at,
      lawyer_profiles.specialization,
      lawyer_profiles.district_bar,
      lawyer_profiles.experience_years,
      lawyer_profiles.bio,
      rev.avg_rating,
      rev.review_count,
      COUNT(*) OVER () AS total_count
    FROM lawyer_profiles
    JOIN users ON users.id = lawyer_profiles.user_id
    LEFT JOIN LATERAL (
      SELECT ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*)::int AS review_count
      FROM lawyer_reviews lr
      WHERE lr.lawyer_profile_id = lawyer_profiles.id AND lr.status <> 'hidden'
    ) rev ON TRUE
    WHERE lawyer_profiles.verification_status = 'approved'
      AND users.account_status = 'active'
      AND users.deactivated_at IS NULL
      AND ($3::text IS NULL OR lawyer_profiles.specialization = $3)
      AND (
        $4::text IS NULL
        OR users.first_name ILIKE $4
        OR users.last_name ILIKE $4
        OR (users.first_name || ' ' || users.last_name) ILIKE $4
        OR lawyer_profiles.specialization ILIKE $4
        OR lawyer_profiles.district_bar ILIKE $4
      )
    ORDER BY lawyer_profiles.experience_years DESC NULLS LAST,
             users.first_name ASC
    LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset, normalizedSpec, searchPattern]
  );

  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
  const items = await Promise.all(result.rows.map(mapDirectoryLawyer));

  return {
    items,
    pagination: {
      total,
      limit: safeLimit,
      offset: safeOffset,
    },
  };
}

// GET /api/lawyers/:lawyerProfileId — single lawyer's public profile.
// Same approval / status / deactivation filters as the directory list
// so a suspended or pending lawyer's UUID isn't reachable through a
// guessed URL. 404 covers both "no such profile" and "profile exists
// but isn't visible to the directory" so the caller can't distinguish
// them.
export async function getApprovedLawyerById(lawyerProfileId) {
  const result = await pool.query(
    `SELECT
      lawyer_profiles.id AS lawyer_profile_id,
      users.id AS user_id,
      users.first_name,
      users.last_name,
      users.avatar_storage_path,
      users.updated_at,
      lawyer_profiles.specialization,
      lawyer_profiles.district_bar,
      lawyer_profiles.experience_years,
      lawyer_profiles.bio,
      rev.avg_rating,
      rev.review_count
    FROM lawyer_profiles
    JOIN users ON users.id = lawyer_profiles.user_id
    LEFT JOIN LATERAL (
      SELECT ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*)::int AS review_count
      FROM lawyer_reviews lr
      WHERE lr.lawyer_profile_id = lawyer_profiles.id AND lr.status <> 'hidden'
    ) rev ON TRUE
    WHERE lawyer_profiles.id = $1
      AND lawyer_profiles.verification_status = 'approved'
      AND users.account_status = 'active'
      AND users.deactivated_at IS NULL
    LIMIT 1`,
    [lawyerProfileId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new ApiError(404, "Lawyer not found");
  }

  return mapDirectoryLawyer(row);
}
