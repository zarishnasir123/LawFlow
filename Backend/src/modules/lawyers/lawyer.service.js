import { pool } from "../../config/db.js";
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
    // Postgres NUMERIC comes back as a string — coerce so the
    // frontend can render and format it without an extra step.
    consultationFee:
      row.consultation_fee !== null && row.consultation_fee !== undefined
        ? Number(row.consultation_fee)
        : null,
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
      lawyer_profiles.consultation_fee,
      COUNT(*) OVER () AS total_count
    FROM lawyer_profiles
    JOIN users ON users.id = lawyer_profiles.user_id
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
