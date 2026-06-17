import { createHash, randomBytes } from "node:crypto";
import { pool } from "../../config/db.js";
import {
  queueAccountDeactivatedEmail,
  queueLawyerRegistrationDecisionEmail,
  queueLawyerSuspensionEmail
} from "../../services/email.service.js";
import {
  deleteLawyerDocuments,
  deleteLawyerStorageFolder,
  deleteUserAvatar,
  getLawyerDocumentSignedUrl,
  getUserAvatarSignedUrl,
  parseLawyerKeyFromStoragePath,
  uploadUserAvatar
} from "../../services/storage.service.js";
import { ApiError } from "../../utils/apiError.js";
import { compareHash, hashValue } from "../../utils/hash.js";
import { deriveLocationFromAddress } from "../../utils/location.js";
import {
  getRefreshTokenDuration,
  getRefreshTokenExpiryDate,
  signAccessToken,
  signReactivationToken,
  signRefreshToken,
  verifyReactivationToken,
  verifyRefreshToken
} from "../../utils/tokens.js";

const maxFailedLoginAttempts = 5;
const lockDurationMinutes = 15;

async function mapAuthUser(row) {
  // Sign the avatar's storage path on the fly. Works for both public
  // and private buckets — the service role key bypasses Supabase's
  // RLS so the browser can render the URL via <img src=…> without
  // any auth headers. TTL is 1 hour; the trailing ?v=<updated_at-ms>
  // cache-busts whenever the user re-uploads, so the browser shows
  // the new picture immediately even if the URL was within its TTL.
  const signed = row.avatar_storage_path
    ? await getUserAvatarSignedUrl(row.avatar_storage_path)
    : null;
  const avatarUrl = signed
    ? `${signed}${signed.includes("?") ? "&" : "?"}v=${row.updated_at ? new Date(row.updated_at).getTime() : Date.now()}`
    : null;

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    cnic: row.cnic,
    role: row.role,
    // Sourced from client_profiles via LEFT JOIN — null for non-client
    // roles and for clients who haven't filled in their location yet.
    // The frontend treats null as an empty field.
    address: row.address || null,
    city: row.city || null,
    tehsil: row.tehsil || null,
    // Public URL to the user's avatar; null when no picture is set.
    // Render on the frontend as <img src={avatarUrl}> with a fallback
    // initials circle when null.
    avatarUrl,
    // Registration timestamp. The client profile page renders this as
    // "Member since <date>". Ships as an ISO string so the frontend
    // can format it for the locale.
    createdAt: row.created_at,
    emailVerified: row.email_verified,
    accountStatus: row.account_status,
    // Surfaced so the frontend can hide the Change Password button
    // (and any other "local credential" UI) for Google-OAuth users.
    // Those accounts have no local password_hash and the backend's
    // change-password endpoint already rejects them with a 403 —
    // exposing the provider lets us avoid showing a button that
    // can't work.
    authProvider: row.auth_provider || null,
    // Surfaced so the frontend can gate every authenticated screen behind a
    // password-change prompt for admin-provisioned accounts. Defaults to
    // false for users who registered themselves (and so chose their own
    // password). Set true by the registrar create/resend-credentials flow.
    mustChangePassword: row.must_change_password === true,
    lawyerVerificationStatus: row.lawyer_verification_status || null,
    // Lawyer-specific profile fields, surfaced for the lawyer's
    // own profile + edit pages. All null for non-lawyer roles
    // (no lawyer_profiles row exists).
    specialization: row.lawyer_specialization || null,
    districtBar: row.lawyer_district_bar || null,
    barLicenseNumber: row.lawyer_bar_license_number || null,
    experienceYears:
      row.lawyer_experience_years !== null && row.lawyer_experience_years !== undefined
        ? Number(row.lawyer_experience_years)
        : null,
    bio: row.lawyer_bio || null,
    // Registrar-profile fields, surfaced via the same /auth/me JOIN as
    // the lawyer/client fields. Both null for non-registrar roles (no
    // registrar_profiles row exists). The registrar's profile page
    // renders them read-only — only the admin can change court/tehsil.
    assignedCourt: row.registrar_assigned_court || null,
    assignedTehsil: row.registrar_assigned_tehsil || null
  };
}

async function mapPendingLawyerDocument(document) {
  const storagePath = document.storage_path;
  const previewUrl = storagePath
    ? await getLawyerDocumentSignedUrl({ storagePath })
    : null;

  return {
    documentType: document.document_type,
    storageBucket: document.storage_bucket,
    storagePath,
    fileName: document.file_name,
    mimeType: document.mime_type,
    fileSize: document.file_size !== null && document.file_size !== undefined
      ? Number(document.file_size)
      : null,
    uploadedAt: document.uploaded_at,
    previewUrl
  };
}

async function mapPendingLawyer(row) {
  const documents = Array.isArray(row.documents) ? row.documents : [];
  const mappedDocuments = await Promise.all(documents.map(mapPendingLawyerDocument));

  return {
    lawyerProfileId: row.lawyer_profile_id,
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    cnic: row.cnic,
    accountStatus: row.account_status,
    emailVerified: row.email_verified,
    specialization: row.specialization,
    districtBar: row.district_bar,
    barLicenseNumber: row.bar_license_number,
    experienceYears: row.experience_years,
    cnicMatch: row.cnic_match,
    cnicMatchRemarks: row.cnic_match_remarks,
    verificationStatus: row.verification_status,
    submittedAt: row.submitted_at,
    documents: mappedDocuments
  };
}

function mapLawyerRejectionHistoryRow(row) {
  return {
    id: row.id,
    email: row.email,
    cnic: row.cnic,
    barLicenseNumber: row.bar_license_number,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    specialization: row.specialization,
    districtBar: row.district_bar,
    rejectionRemarks: row.rejection_remarks,
    rejectedByEmail: row.rejected_by_email,
    rejectedAt: row.rejected_at,
    storagePathsCleared: row.storage_paths_cleared
  };
}

async function findLatestLawyerRejectionByEmail(email) {
  const result = await pool.query(
    `SELECT rejection_remarks, rejected_at
    FROM lawyer_rejection_history
    WHERE email = $1
    ORDER BY rejected_at DESC
    LIMIT 1`,
    [email]
  );

  return result.rows[0] || null;
}

async function findAuthUserByEmail(email) {
  const result = await pool.query(
    `SELECT
      users.id,
      users.first_name,
      users.last_name,
      users.email,
      users.phone,
      users.cnic,
      users.password_hash,
      users.auth_provider,
      users.email_verified,
      users.account_status,
      users.deactivated_at,
      users.must_change_password,
      users.failed_login_attempts,
      users.locked_until,
      roles.name AS role,
      lawyer_profiles.verification_status AS lawyer_verification_status
    FROM users
    JOIN roles ON roles.id = users.role_id
    LEFT JOIN lawyer_profiles ON lawyer_profiles.user_id = users.id
    WHERE users.email = $1`,
    [email]
  );

  return result.rows[0] || null;
}

async function findAuthUserById(userId) {
  const result = await pool.query(
    `SELECT
      users.id,
      users.first_name,
      users.last_name,
      users.email,
      users.phone,
      users.cnic,
      users.email_verified,
      users.account_status,
      users.deactivated_at,
      users.auth_provider,
      users.must_change_password,
      users.avatar_storage_path,
      users.created_at,
      users.updated_at,
      roles.name AS role,
      lawyer_profiles.verification_status AS lawyer_verification_status,
      lawyer_profiles.specialization AS lawyer_specialization,
      lawyer_profiles.district_bar AS lawyer_district_bar,
      lawyer_profiles.bar_license_number AS lawyer_bar_license_number,
      lawyer_profiles.experience_years AS lawyer_experience_years,
      lawyer_profiles.bio AS lawyer_bio,
      client_profiles.address AS address,
      client_profiles.city AS city,
      client_profiles.tehsil AS tehsil,
      registrar_profiles.assigned_court AS registrar_assigned_court,
      registrar_profiles.assigned_tehsil AS registrar_assigned_tehsil
    FROM users
    JOIN roles ON roles.id = users.role_id
    LEFT JOIN lawyer_profiles ON lawyer_profiles.user_id = users.id
    LEFT JOIN client_profiles ON client_profiles.user_id = users.id
    LEFT JOIN registrar_profiles ON registrar_profiles.user_id = users.id
    WHERE users.id = $1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function recordFailedLogin(user) {
  const nextFailedAttempts = Number(user.failed_login_attempts || 0) + 1;
  const shouldLock = nextFailedAttempts >= maxFailedLoginAttempts;
  const lockedUntil = shouldLock
    ? new Date(Date.now() + lockDurationMinutes * 60 * 1000)
    : null;

  await pool.query(
    `UPDATE users
    SET failed_login_attempts = $1,
        locked_until = $2,
        updated_at = NOW()
    WHERE id = $3`,
    [nextFailedAttempts, lockedUntil, user.id]
  );
}

async function resetLoginLock(userId) {
  await pool.query(
    `UPDATE users
    SET failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
    WHERE id = $1`,
    [userId]
  );
}

// Days inside which a self-deactivated account can sign back in and
// have it silently flipped to active. Past this window, the next
// login attempt hard-deletes the row and returns 410. Tunable here
// if we ever want to lengthen it.
const DEACTIVATION_RECOVERY_WINDOW_DAYS = 30;

// Shared 30-day recovery / permanent-delete handling for both the
// password login path (loginUser) and the OAuth path
// (issueOAuthSession). Call AFTER the caller has proven identity
// (password verified for local login, OAuth verified upstream for
// Google).
//
// Returns one of:
//   • null                          → not deactivated, proceed normally
//   • { reactivationRequired: true, // within window — prompt the user
//       reactivationToken, deactivatedAt }
//   • throws 410 / 409              → past window or cascade blocked
//
// The two-step prompt is intentional: silent reactivation is
// surprising UX and removes the user's ability to back out of a
// recovery they didn't mean to start (someone else logging into an
// abandoned account, a typo'd email, etc).
async function handleSelfDeactivationRecovery(user) {
  if (user.account_status !== "inactive" || !user.deactivated_at) return null;

  const ageMs = Date.now() - new Date(user.deactivated_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays > DEACTIVATION_RECOVERY_WINDOW_DAYS) {
    // Permanent delete. FK cascades wipe client_profiles +
    // auth_sessions. If any FK lacks ON DELETE CASCADE
    // (signature_requests / cases), the query throws 23503; we
    // surface that as 409 so the user can contact support instead
    // of leaving the row half-deleted.
    try {
      await pool.query(`DELETE FROM users WHERE id = $1`, [user.id]);
    } catch (err) {
      if (err.code === "23503") {
        throw new ApiError(
          409,
          "Account is past the 30-day recovery window but still has linked records. Contact support to finish removal."
        );
      }
      throw err;
    }
    throw new ApiError(
      410,
      "Account no longer exists. Please register again to continue."
    );
  }

  // Within window → hand the caller a short-lived token so the
  // frontend can show the "Continue & Reactivate" dialog. Account
  // stays inactive until the user explicitly confirms via
  // POST /auth/reactivate; if they Cancel, nothing changes.
  const reactivationToken = signReactivationToken({ sub: user.id });
  return {
    reactivationRequired: true,
    reactivationToken,
    deactivatedAt: user.deactivated_at,
  };
}

// SHA-256 of the signed refresh JWT gives an O(1) UNIQUE-indexed lookup at
// logout / refresh time. bcrypt's slowness only matters for low-entropy
// secrets (passwords); applying it to a high-entropy session token forced a
// linear scan + bcrypt-compare per active session, so a user with 5–10 stale
// sessions paid ~0.5–1s on every logout. The same reasoning is already
// applied to password-reset tokens via hashResetToken further down this file.
function hashRefreshToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function createAuthSession({ userId, refreshToken, refreshTokenDuration, req }) {
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = getRefreshTokenExpiryDate(refreshTokenDuration);

  await pool.query(
    `INSERT INTO auth_sessions (
      user_id,
      refresh_token_hash,
      user_agent,
      ip_address,
      expires_at
    )
    VALUES ($1, $2, $3, $4, $5)`,
    [
      userId,
      refreshTokenHash,
      req.headers["user-agent"] || null,
      req.ip || null,
      expiresAt
    ]
  );

  return expiresAt;
}

async function issueSessionTokens({ user, rememberMe, req }) {
  const tokenPayload = {
    sub: user.id,
    role: user.role,
    rememberMe
  };
  const refreshTokenDuration = getRefreshTokenDuration(rememberMe);
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload, refreshTokenDuration);
  const refreshTokenExpiresAt = await createAuthSession({
    userId: user.id,
    refreshToken,
    refreshTokenDuration,
    req
  });

  return { accessToken, refreshToken, refreshTokenExpiresAt };
}

async function findMatchingRefreshSession({ userId, refreshToken }) {
  const tokenHash = hashRefreshToken(refreshToken);

  const result = await pool.query(
    `SELECT id, expires_at, is_revoked
    FROM auth_sessions
    WHERE user_id = $1
      AND refresh_token_hash = $2
      AND is_revoked = false
      AND expires_at > NOW()
    LIMIT 1`,
    [userId, tokenHash]
  );

  return result.rows[0] || null;
}

async function revokeAuthSession(sessionId) {
  await pool.query(
    `UPDATE auth_sessions
    SET is_revoked = true,
        revoked_at = NOW()
    WHERE id = $1`,
    [sessionId]
  );
}

export async function loginUser({ email, password, rememberMe = false, expectedRole = null, req }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await findAuthUserByEmail(normalizedEmail);

  if (!user) {
    const rejection = await findLatestLawyerRejectionByEmail(normalizedEmail);

    if (rejection) {
      const remarks = rejection.rejection_remarks?.trim()
        || "Please review your rejection email for details.";

      throw new ApiError(
        403,
        `Your lawyer registration was returned by admin and must be submitted again. Reason: ${remarks} Register again at /register with updated documents.`
      );
    }

    throw new ApiError(401, "Invalid email or password");
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    throw new ApiError(423, "Account is temporarily locked. Please try again later");
  }

  // Block login before the password check for non-active accounts so a
  // suspended user can't even confirm their credentials are valid.
  if (user.account_status === "suspended") {
    throw new ApiError(403, "Your account has been suspended. Contact support.");
  }

  // Self-deactivation handling: when the user previously clicked
  // "Deactivate Account" we stamped users.deactivated_at. We verify
  // the password FIRST (so an unauthenticated caller can't probe
  // for deactivated accounts or trigger any state change), then
  // either hand back a reactivation prompt (within 30 days), throw
  // 410 (past 30 days, row already deleted by the helper), or fall
  // through to the normal login flow (no deactivated_at).
  let passwordAlreadyVerified = false;
  if (user.account_status === "inactive" && user.deactivated_at) {
    const ok = await compareHash(password, user.password_hash);
    if (!ok) {
      await recordFailedLogin(user);
      throw new ApiError(401, "Invalid password. Please try again.");
    }
    passwordAlreadyVerified = true;

    // Match the wrong-tab rejection below so a deactivated client
    // signing in through the lawyer tab still gets a generic error.
    if (expectedRole && user.role !== expectedRole) {
      throw new ApiError(401, "Invalid email or password");
    }

    const recovery = await handleSelfDeactivationRecovery(user);
    if (recovery?.reactivationRequired) {
      // Short-circuit: hand the reactivation token back to the
      // controller so the frontend can show the confirmation
      // dialog. No session is issued yet — that happens on the
      // separate POST /auth/reactivate call.
      return recovery;
    }
  }

  // A freshly registered lawyer awaiting admin approval has
  // account_status='inactive' (set in registration.service.js). For lawyers
  // we let the flow fall through so the dedicated "pending admin approval"
  // message below fires — much friendlier than the generic inactive one.
  // For non-lawyers, account_status='inactive' WITHOUT deactivated_at is
  // an admin-imposed deactivation (the self-deactivation path above sets
  // deactivated_at and already handled it).
  if (user.account_status === "inactive" && user.role !== "lawyer") {
    throw new ApiError(403, "Your account is inactive. Contact support.");
  }

  if (!passwordAlreadyVerified) {
    const passwordMatches = await compareHash(password, user.password_hash);

    if (!passwordMatches) {
      await recordFailedLogin(user);
      throw new ApiError(401, "Invalid password. Please try again.");
    }
  }

  // Frontend role tabs pass expectedRole. A correct-credentials wrong-tab
  // attempt is folded into the generic invalid-credentials response so the
  // backend doesn't leak which role the email actually belongs to (e.g. the
  // "lawyer pending approval" message below would otherwise tell a Client-tab
  // user that they have a lawyer account in this system).
  if (expectedRole && user.role !== expectedRole) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (!user.email_verified) {
    throw new ApiError(403, "Please verify your email before logging in");
  }

  if (user.role === "lawyer" && user.lawyer_verification_status !== "approved") {
    throw new ApiError(
      403,
      "Your lawyer account is pending admin approval. You will receive an email once your registration is approved or returned."
    );
  }

  if (user.account_status !== "active") {
    throw new ApiError(403, "Account is not active");
  }

  await resetLoginLock(user.id);

  const tokens = await issueSessionTokens({ user, rememberMe, req });

  return {
    user: await mapAuthUser(user),
    ...tokens,
    rememberMe
  };
}

export async function refreshAuthSession({ refreshToken, req }) {
  if (!refreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }

  let decodedToken = null;

  try {
    decodedToken = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await findAuthUserById(decodedToken.sub);

  if (!user) {
    throw new ApiError(401, "Invalid refresh token");
  }

  if (!user.email_verified || user.account_status !== "active") {
    throw new ApiError(403, "Account is not allowed to refresh session");
  }

  if (user.role === "lawyer" && user.lawyer_verification_status !== "approved") {
    throw new ApiError(403, "Lawyer account is not approved");
  }

  const matchingSession = await findMatchingRefreshSession({
    userId: user.id,
    refreshToken
  });

  if (!matchingSession) {
    throw new ApiError(401, "Refresh session is not valid");
  }

  await revokeAuthSession(matchingSession.id);

  const rememberMe = decodedToken.rememberMe === true;
  const tokens = await issueSessionTokens({ user, rememberMe, req });

  return {
    user: await mapAuthUser(user),
    ...tokens,
    rememberMe
  };
}

export async function logoutUser(refreshToken) {
  if (!refreshToken) {
    return;
  }

  let decodedToken = null;

  try {
    decodedToken = verifyRefreshToken(refreshToken);
  } catch {
    return;
  }

  const matchingSession = await findMatchingRefreshSession({
    userId: decodedToken.sub,
    refreshToken
  });

  if (matchingSession) {
    await revokeAuthSession(matchingSession.id);
  }
}

// Atomically marks the user's first dashboard view and exposes a
// `firstLoginCompleted` flag the frontend uses to switch between
// "Welcome, X" (first ever visit) and "Welcome back, X" (every visit after).
// The flag is true for any user whose first_login_at is already set; the
// UPDATE...RETURNING below also returns rows where it was already set, so
// we can distinguish on the result of an atomic compare-and-set.
export async function getCurrentUser(userId) {
  // CAS on first_login_at: set it to NOW() only if it was null. The
  // RETURNING xmin trick isn't portable; instead we run an UPDATE that
  // restricts to the null case and check whether any row was actually
  // modified. If rowCount === 1, this is the user's first dashboard view.
  const claimResult = await pool.query(
    `UPDATE users
     SET first_login_at = NOW()
     WHERE id = $1 AND first_login_at IS NULL
     RETURNING id`,
    [userId]
  );

  const isFirstLogin = claimResult.rowCount === 1;

  const user = await findAuthUserById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return {
    ...(await mapAuthUser(user)),
    firstLoginCompleted: !isFirstLogin
  };
}

// PATCH /auth/me — apply a partial update to the logged-in user's
// profile. Fields go to two places:
//   • first_name, last_name, email, phone, cnic → users
//   • address                                   → client_profiles
// Wrapped in a single transaction so a unique-violation on, say,
// email doesn't leave a half-updated address behind.
//
// `patch` is the validated request body. Any key that's undefined
// is left alone; explicit empty strings on `phone` / `cnic` /
// `address` are coerced to NULL so the lawyer can clear the value.
export async function updateCurrentUser({ userId, patch }) {
  // Whitelist + normalize. `optionalStringField` already trimmed
  // each value via getTrimmedField at validator time, but the body
  // can also arrive via Express directly so we re-trim defensively.
  const trim = (v) => (typeof v === "string" ? v.trim() : v);
  // Numeric coercion for the lawyer-profile fields. The validator
  // already ran isInt/isFloat + toInt/toFloat, but PATCH bodies can
  // arrive raw via Express, and we want NULL to mean "clear it"
  // rather than NaN. Empty strings → null; valid numbers → number;
  // anything else → undefined (skip the field).
  const num = (v) => {
    if (v === null || v === "" || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const normalized = {
    first_name: patch.firstName !== undefined ? trim(patch.firstName) : undefined,
    last_name: patch.lastName !== undefined ? trim(patch.lastName) : undefined,
    email: patch.email !== undefined ? trim(patch.email).toLowerCase() : undefined,
    phone: patch.phone !== undefined ? trim(patch.phone) : undefined,
    cnic: patch.cnic !== undefined ? trim(patch.cnic) : undefined,
    address: patch.address !== undefined ? trim(patch.address) : undefined,
    city: patch.city !== undefined ? trim(patch.city) : undefined,
    tehsil: patch.tehsil !== undefined ? trim(patch.tehsil) : undefined,
    // Lawyer-profile fields. Pre-normalize specialization to
    // Title Case so the DB has a single canonical value regardless
    // of how the frontend sent it (the validator accepts any case).
    specialization:
      patch.specialization !== undefined
        ? (() => {
            const s = trim(patch.specialization);
            if (!s) return null;
            return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
          })()
        : undefined,
    district_bar: patch.districtBar !== undefined ? trim(patch.districtBar) : undefined,
    experience_years: patch.experienceYears !== undefined ? num(patch.experienceYears) : undefined,
    // Bio: empty string clears the value (so a lawyer can wipe their
    // about-section); otherwise just trim and keep the user's text.
    bio: patch.bio !== undefined ? (trim(patch.bio) || null) : undefined
  };

  // Auto-derive city + tehsil from the address string whenever the
  // address is being updated and the caller hasn't supplied explicit
  // values. This keeps the user from having to type their city /
  // tehsil twice — most Pakistani addresses already end with the
  // city, and the tehsil is one of a small known set. Explicit
  // values still win when sent (covers any future UI that DOES want
  // to override the heuristic).
  if (normalized.address !== undefined) {
    const derived = deriveLocationFromAddress(normalized.address);
    if (normalized.city === undefined) normalized.city = derived.city;
    if (normalized.tehsil === undefined) normalized.tehsil = derived.tehsil;
  }

  const usersUpdates = ["first_name", "last_name", "email", "phone", "cnic"]
    .filter((col) => normalized[col] !== undefined);
  const profileUpdates = ["address", "city", "tehsil"]
    .filter((col) => normalized[col] !== undefined);
  // Lawyer-profile updates: never include bar_license_number,
  // verification_status, cnic_match, verified_by, or verified_at.
  // Those are either UNIQUE-constraint locked or admin-only — see
  // the editable-field table in the plan.
  const lawyerProfileUpdates = ["specialization", "district_bar", "experience_years", "bio"]
    .filter((col) => normalized[col] !== undefined);

  // Empty PATCH is a no-op — just return the current state.
  if (
    usersUpdates.length === 0 &&
    profileUpdates.length === 0 &&
    lawyerProfileUpdates.length === 0
  ) {
    const user = await findAuthUserById(userId);
    if (!user) throw new ApiError(404, "User not found");
    return await mapAuthUser(user);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (usersUpdates.length > 0) {
      // Build "col = $1, col2 = $2, ..." with values aligned to params.
      const setClauses = usersUpdates.map((col, idx) => `${col} = $${idx + 1}`);
      const values = usersUpdates.map((col) => normalized[col] || null);
      setClauses.push(`updated_at = NOW()`);
      values.push(userId);
      await client.query(
        `UPDATE users
         SET ${setClauses.join(", ")}
         WHERE id = $${values.length}`,
        values
      );
    }

    if (profileUpdates.length > 0) {
      // Clients have a client_profiles row from registration (the
      // strategy inserts one even when these fields were blank), but
      // we can't rely on that for non-client roles or older accounts.
      // ON CONFLICT (user_id) safely creates-or-updates either way.
      // We insert NULL for any profile column NOT in this patch on
      // first-insert (the row is brand new); for an UPDATE we only
      // overwrite the columns in the patch — the others stay put.
      const insertCols = ["user_id", ...profileUpdates];
      const insertValues = [userId, ...profileUpdates.map((c) => normalized[c] || null)];
      const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(", ");
      const updateClauses = profileUpdates
        .map((c) => `${c} = EXCLUDED.${c}`)
        .concat(["updated_at = NOW()"])
        .join(", ");
      await client.query(
        `INSERT INTO client_profiles (${insertCols.join(", ")})
         VALUES (${placeholders})
         ON CONFLICT (user_id) DO UPDATE
         SET ${updateClauses}`,
        insertValues
      );
    }

    if (lawyerProfileUpdates.length > 0) {
      // Lawyers always get a lawyer_profiles row at registration (the
      // strategy inserts it before the user even sees the dashboard),
      // and only lawyers have one — so we gate the write on role.
      // A non-lawyer who somehow passed lawyer fields in the body
      // gets a silent no-op rather than a 4xx, because the validator
      // already accepted them and surfacing an error here would be
      // confusing UX. The DB also wouldn't have a row to update.
      const roleRow = await client.query(
        `SELECT roles.name FROM users
         JOIN roles ON roles.id = users.role_id
         WHERE users.id = $1`,
        [userId]
      );
      const role = roleRow.rows[0]?.name;
      if (role === "lawyer") {
        // We use UPDATE-only (not UPSERT) because every lawyer is
        // guaranteed a row from registration. INSERT would need all
        // NOT-NULL columns (bar_license_number) which we deliberately
        // don't accept here — UPDATE on just the patched columns
        // sidesteps that.
        const setClauses = lawyerProfileUpdates.map((col, idx) => `${col} = $${idx + 1}`);
        const values = lawyerProfileUpdates.map((col) => normalized[col]);
        setClauses.push(`updated_at = NOW()`);
        values.push(userId);
        await client.query(
          `UPDATE lawyer_profiles
           SET ${setClauses.join(", ")}
           WHERE user_id = $${values.length}`,
          values
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");

    // Surface duplicate-key violations as a clean 409 with a field
    // hint so the frontend can render an inline error. Mirrors the
    // pattern used in registration.service.js.
    if (error.code === "23505") {
      if (error.constraint === "users_email_key") {
        throw new ApiError(409, "That email is already in use");
      }
      if (error.constraint === "users_cnic_key") {
        throw new ApiError(409, "That CNIC is already in use");
      }
      throw new ApiError(409, "That email or CNIC is already in use");
    }

    throw error;
  } finally {
    client.release();
  }

  const updated = await findAuthUserById(userId);
  if (!updated) throw new ApiError(404, "User not found");
  return await mapAuthUser(updated);
}

// DELETE /auth/me — self-service account deactivation.
//
// Soft delete only: we flip account_status='inactive' on users and
// revoke every refresh-token row in auth_sessions for the user. The
// existing access token (a short-lived JWT, ~15 min) stays valid
// until natural expiry; the next /refresh call rejects because the
// session row is gone, and subsequent /login attempts are blocked
// by the inactive check in finalizeLogin.
//
// Why not a hard DELETE on users?
//   1. Cascades would wipe the user's cases, signature_requests,
//      client_profiles row — destroying audit history other roles
//      (lawyer, registrar, admin) may still need to reference.
//   2. Recovery: an admin can flip status back to 'active' without
//      re-creating identity from scratch.
//   3. The frontend treats /me 401 as "logged out", and login is
//      gated on account_status, so soft-delete is functionally
//      indistinguishable to the user.
export async function deactivateCurrentUser({ userId }) {
  const client = await pool.connect();
  let emailContext = null;
  try {
    await client.query("BEGIN");

    // RETURNING the email + name + deactivated_at so we can fire the
    // confirmation email after commit without a second SELECT. The
    // timestamp comes back as a Date so we can format it the same
    // way the recovery-window math does.
    const result = await client.query(
      `UPDATE users
       SET account_status = 'inactive',
           deactivated_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING email, first_name, deactivated_at`,
      [userId]
    );
    if (result.rowCount === 0) {
      throw new ApiError(404, "User not found");
    }

    // Revoke every active session for this user so any other browser
    // / device they're signed in on can't refresh past expiry. We
    // DELETE rather than UPDATE is_revoked=true because the rows have
    // ON DELETE CASCADE from users — leaving them lying around just
    // wastes a row per deactivation.
    await client.query(
      `DELETE FROM auth_sessions WHERE user_id = $1`,
      [userId]
    );

    await client.query("COMMIT");
    emailContext = result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  // Fire the confirmation email AFTER commit so a delivery failure
  // never rolls back the deactivation itself. The queue helper
  // already swallows downstream errors with a console.error, so this
  // call is purely fire-and-forget.
  if (emailContext) {
    const deactivatedAt = emailContext.deactivated_at;
    const recoveryDeadline = new Date(
      new Date(deactivatedAt).getTime() +
        DEACTIVATION_RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    queueAccountDeactivatedEmail({
      email: emailContext.email,
      firstName: emailContext.first_name,
      deactivatedAt,
      recoveryDeadline,
    });
  }
}

// POST /auth/me/avatar — replace the user's profile picture. The
// uploaded buffer goes to the public `user-avatars` Supabase bucket
// at users/{userId}/avatar.{ext}; we then record the path on
// users.avatar_storage_path so /auth/me can render the public URL
// on every subsequent fetch. Re-upload replaces the previous file
// in place via Supabase's upsert (one slot per user — we don't
// keep history).
export async function setMyAvatar({ userId, file }) {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new ApiError(400, "Profile picture file is required");
  }

  // Derive extension from mime type. The multer middleware already
  // rejected anything that isn't image/jpeg or image/png, so this
  // map is exhaustive.
  const extension = file.mimetype === "image/png" ? "png" : "jpg";

  const { storagePath } = await uploadUserAvatar({
    userId,
    fileBuffer: file.buffer,
    mimeType: file.mimetype,
    extension
  });

  // Bump updated_at so the cache-busting ?v=<timestamp> on the
  // returned avatar URL flips and the browser fetches the new image
  // instead of showing the old cached one.
  await pool.query(
    `UPDATE users
     SET avatar_storage_path = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [storagePath, userId]
  );

  const updated = await findAuthUserById(userId);
  if (!updated) throw new ApiError(404, "User not found");
  return await mapAuthUser(updated);
}

// POST /auth/reactivate — finalize the reactivation flow.
//
// The caller hands us the short-lived reactivationToken minted by
// loginUser / issueOAuthSession. We verify the token (signature +
// not-expired + purpose=reactivate), look up the user, re-check
// that the account is still within the 30-day recovery window
// (defence in depth: the token alone shouldn't be enough — if the
// account already crossed the window between login and confirm,
// reactivation is no longer allowed), flip status='active', then
// issue session tokens and return the same shape login returns.
export async function reactivateAccount({ reactivationToken, req }) {
  let claims;
  try {
    claims = verifyReactivationToken(reactivationToken);
  } catch {
    throw new ApiError(401, "Reactivation link is invalid or expired.");
  }

  const userId = claims.sub;
  const user = await findAuthUserById(userId);
  if (!user) {
    throw new ApiError(404, "Account not found.");
  }

  // Account must still be the one we offered to reactivate. If the
  // user already signed in via another path (unlikely but possible)
  // we just hand them a fresh session — idempotent. If the row was
  // hard-deleted in the meantime, findAuthUserById returns null and
  // we 404 above.
  if (user.account_status === "inactive" && user.deactivated_at) {
    const ageMs = Date.now() - new Date(user.deactivated_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > DEACTIVATION_RECOVERY_WINDOW_DAYS) {
      // Window closed between login and reactivate confirmation.
      // Don't auto-delete here — let the next login attempt go
      // through the unified delete-or-prompt path.
      throw new ApiError(
        410,
        "The 30-day recovery window has ended. Reactivation is no longer possible."
      );
    }

    await pool.query(
      `UPDATE users
       SET account_status = 'active',
           deactivated_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );
    user.account_status = "active";
    user.deactivated_at = null;
  } else if (user.account_status !== "active") {
    // Some other status (suspended, etc.) — reactivation isn't the
    // right tool. Surface a generic error so we don't leak the
    // specific gate to whoever holds the token.
    throw new ApiError(403, "Account cannot be reactivated.");
  }

  const tokens = await issueSessionTokens({ user, rememberMe: false, req });
  return {
    user: await mapAuthUser(user),
    ...tokens,
    rememberMe: false,
  };
}

// DELETE /auth/me/avatar — drop the user's profile picture so the
// initials fallback renders again. We clear the DB column first
// (source of truth for the frontend) then attempt to remove the
// Supabase object. The storage removal is best-effort: leaving an
// orphan file is harmless and shouldn't block the user's click.
export async function removeMyAvatar({ userId }) {
  // Read the current path so we know what to remove from storage.
  // If the user has no avatar set, the UPDATE below is a no-op and
  // we return the user unchanged — frontend sees avatarUrl=null
  // either way.
  const existing = await pool.query(
    `SELECT avatar_storage_path FROM users WHERE id = $1`,
    [userId]
  );
  if (existing.rowCount === 0) throw new ApiError(404, "User not found");
  const previousPath = existing.rows[0].avatar_storage_path;

  await pool.query(
    `UPDATE users
     SET avatar_storage_path = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );

  if (previousPath) {
    await deleteUserAvatar(previousPath);
  }

  const updated = await findAuthUserById(userId);
  if (!updated) throw new ApiError(404, "User not found");
  return await mapAuthUser(updated);
}

export async function listLawyerRejectionHistory({
  limit = 20,
  offset = 0,
  search = ""
} = {}) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
  const safeOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);
  const keyword = typeof search === "string" ? search.trim() : "";
  const searchPattern = keyword ? `%${keyword}%` : null;

  const result = await pool.query(
    `SELECT
      id,
      email,
      cnic,
      bar_license_number,
      first_name,
      last_name,
      phone,
      specialization,
      district_bar,
      rejection_remarks,
      rejected_by_email,
      rejected_at,
      storage_paths_cleared,
      COUNT(*) OVER () AS total_count
    FROM lawyer_rejection_history
    WHERE (
      $3::text IS NULL
      OR email ILIKE $3
      OR first_name ILIKE $3
      OR last_name ILIKE $3
      OR bar_license_number ILIKE $3
      OR COALESCE(cnic, '') ILIKE $3
    )
    ORDER BY rejected_at DESC
    LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset, searchPattern]
  );

  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;

  return {
    items: result.rows.map(mapLawyerRejectionHistoryRow),
    pagination: {
      total,
      limit: safeLimit,
      offset: safeOffset
    }
  };
}

async function listLawyerVerificationsByStatus({ statuses, limit, offset }) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
  const safeOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);

  const result = await pool.query(
    `SELECT
      lawyer_profiles.id AS lawyer_profile_id,
      users.id AS user_id,
      users.first_name,
      users.last_name,
      users.email,
      users.phone,
      users.cnic,
      users.account_status,
      users.email_verified,
      lawyer_profiles.specialization,
      lawyer_profiles.district_bar,
      lawyer_profiles.bar_license_number,
      lawyer_profiles.experience_years,
      lawyer_profiles.cnic_match,
      lawyer_profiles.cnic_match_remarks,
      lawyer_profiles.verification_status,
      lawyer_profiles.verification_remarks,
      lawyer_profiles.verified_at,
      lawyer_profiles.created_at AS submitted_at,
      COUNT(*) OVER () AS total_count,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'document_type', d.document_type,
              'storage_bucket', d.storage_bucket,
              'storage_path', d.storage_path,
              'file_name', d.file_name,
              'mime_type', d.mime_type,
              'file_size', d.file_size,
              'uploaded_at', d.uploaded_at
            )
            ORDER BY d.document_type
          )
          FROM lawyer_verification_documents d
          WHERE d.lawyer_profile_id = lawyer_profiles.id
        ),
        '[]'::json
      ) AS documents
    FROM lawyer_profiles
    JOIN users ON users.id = lawyer_profiles.user_id
    WHERE lawyer_profiles.verification_status = ANY($3::text[])
    ORDER BY lawyer_profiles.created_at ASC
    LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset, statuses]
  );

  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
  const items = await Promise.all(result.rows.map(mapPendingLawyer));

  return {
    items,
    pagination: {
      total,
      limit: safeLimit,
      offset: safeOffset
    }
  };
}

export function listPendingLawyerVerifications({ limit = 20, offset = 0 } = {}) {
  return listLawyerVerificationsByStatus({ statuses: ["pending"], limit, offset });
}

export function listActiveLawyerVerifications({ limit = 20, offset = 0 } = {}) {
  return listLawyerVerificationsByStatus({
    statuses: ["approved", "suspended"],
    limit,
    offset
  });
}

// Approve path: keep the user, flip lawyer_profiles.verification_status to
// 'approved' and users.account_status to 'active', send the welcome decision
// email, return the updated record.
async function approveLawyerRegistrationTx(client, { lawyerProfile, adminUserId, remarks }) {
  const updatedProfileResult = await client.query(
    `UPDATE lawyer_profiles
    SET verification_status = 'approved',
        verification_remarks = $1,
        verified_by = $2,
        verified_at = NOW(),
        updated_at = NOW()
    WHERE id = $3
    RETURNING id, user_id, verification_status, verification_remarks, verified_by, verified_at`,
    [remarks?.trim() || null, adminUserId, lawyerProfile.id]
  );

  const updatedUserResult = await client.query(
    `UPDATE users
    SET account_status = 'active',
        updated_at = NOW()
    WHERE id = $1
    RETURNING id, first_name, last_name, email, account_status, email_verified`,
    [lawyerProfile.user_id]
  );

  return {
    updatedProfile: updatedProfileResult.rows[0],
    updatedUser: updatedUserResult.rows[0]
  };
}

// Reject path: persist the rejection to lawyer_rejection_history (so the
// audit survives the cleanup), capture every storage_path tied to this
// lawyer, then delete the user row. lawyer_profiles + lawyer_verification_documents
// cascade via the existing FKs, so the SQL side is left in a clean state and
// the email is free to re-register. The actual Supabase files are removed
// outside the transaction.
async function rejectLawyerRegistrationTx(client, {
  lawyerProfile,
  adminUserId,
  adminEmail,
  remarks
}) {
  const documentRows = (await client.query(
    `SELECT storage_path
    FROM lawyer_verification_documents
    WHERE lawyer_profile_id = $1`,
    [lawyerProfile.id]
  )).rows;

  const storagePaths = documentRows
    .map((row) => row.storage_path)
    .filter(Boolean);

  await client.query(
    `INSERT INTO lawyer_rejection_history (
      email, cnic, bar_license_number,
      first_name, last_name, phone,
      specialization, district_bar,
      rejection_remarks, rejected_by_user_id, rejected_by_email,
      storage_paths_cleared
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      lawyerProfile.email,
      lawyerProfile.cnic,
      lawyerProfile.bar_license_number,
      lawyerProfile.first_name,
      lawyerProfile.last_name,
      lawyerProfile.phone,
      lawyerProfile.specialization,
      lawyerProfile.district_bar,
      remarks?.trim() || null,
      adminUserId,
      adminEmail,
      storagePaths.length > 0 ? storagePaths : null
    ]
  );

  // Cascade deletes lawyer_profile + lawyer_verification_documents +
  // client_profile (none for lawyers) + auth_sessions + auth_identities +
  // email_verification_otps + password_reset_tokens.
  await client.query(`DELETE FROM users WHERE id = $1`, [lawyerProfile.user_id]);

  // Also clear any leftover pending_registrations row for this email/CNIC
  // (best-effort — there usually isn't one once they've reached lawyer_profiles).
  await client.query(
    `DELETE FROM pending_registrations
    WHERE email = $1 OR cnic = $2`,
    [lawyerProfile.email, lawyerProfile.cnic]
  );

  return { storagePaths };
}

export async function reviewLawyerRegistration({
  lawyerProfileId,
  adminUserId,
  status,
  remarks = null
}) {
  if (!["approved", "rejected"].includes(status)) {
    throw new ApiError(400, "Status must be approved or rejected");
  }

  if (status === "rejected" && !remarks?.trim()) {
    throw new ApiError(400, "Rejection remarks are required");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // The route enforces authenticate + authorizeRoles('admin'), so the role
    // is already proven. We still need the admin's email for the audit row.
    const adminResult = await client.query(
      `SELECT email FROM users WHERE id = $1`,
      [adminUserId]
    );
    const adminEmail = adminResult.rows[0]?.email || null;

    // FOR UPDATE OF lawyer_profiles serialises concurrent reviewers — a second
    // admin clicking Approve/Reject on the same lawyer at the same instant
    // blocks here until this transaction commits, then re-reads the row and
    // hits the already-reviewed guard below.
    const lawyerProfileResult = await client.query(
      `SELECT
        lawyer_profiles.id,
        lawyer_profiles.user_id,
        lawyer_profiles.verification_status,
        lawyer_profiles.bar_license_number,
        lawyer_profiles.specialization,
        lawyer_profiles.district_bar,
        users.email,
        users.first_name,
        users.last_name,
        users.phone,
        users.cnic,
        users.account_status
      FROM lawyer_profiles
      JOIN users ON users.id = lawyer_profiles.user_id
      WHERE lawyer_profiles.id = $1
      FOR UPDATE OF lawyer_profiles`,
      [lawyerProfileId]
    );

    if (lawyerProfileResult.rowCount === 0) {
      throw new ApiError(404, "Lawyer registration request not found");
    }

    const lawyerProfile = lawyerProfileResult.rows[0];

    if (lawyerProfile.verification_status !== "pending") {
      throw new ApiError(409, "Lawyer registration has already been reviewed");
    }

    if (status === "approved") {
      const { updatedProfile, updatedUser } = await approveLawyerRegistrationTx(client, {
        lawyerProfile,
        adminUserId,
        remarks
      });

      await client.query("COMMIT");

      queueLawyerRegistrationDecisionEmail({
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        status: "approved",
        remarks: updatedProfile.verification_remarks
      });

      return {
        lawyerProfileId: updatedProfile.id,
        userId: updatedUser.id,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        email: updatedUser.email,
        emailVerified: updatedUser.email_verified,
        accountStatus: updatedUser.account_status,
        verificationStatus: updatedProfile.verification_status,
        verificationRemarks: updatedProfile.verification_remarks,
        verifiedBy: updatedProfile.verified_by,
        verifiedAt: updatedProfile.verified_at
      };
    }

    // Rejection branch.
    const { storagePaths } = await rejectLawyerRegistrationTx(client, {
      lawyerProfile,
      adminUserId,
      adminEmail,
      remarks
    });

    await client.query("COMMIT");

    // Best-effort storage cleanup (post-commit so a storage failure cannot
    // leave the DB in a half-rolled-back state).
    const lawyerKey = storagePaths
      .map(parseLawyerKeyFromStoragePath)
      .find(Boolean) ?? null;
    if (lawyerKey) {
      await deleteLawyerStorageFolder({ lawyerKey });
    } else if (storagePaths.length > 0) {
      await deleteLawyerDocuments({ storagePaths });
    }

    queueLawyerRegistrationDecisionEmail({
      email: lawyerProfile.email,
      firstName: lawyerProfile.first_name,
      status: "rejected",
      remarks: remarks?.trim() || null
    });

    return {
      lawyerProfileId: lawyerProfile.id,
      userId: lawyerProfile.user_id,
      firstName: lawyerProfile.first_name,
      lastName: lawyerProfile.last_name,
      email: lawyerProfile.email,
      userDeleted: true,
      verificationStatus: "rejected",
      verificationRemarks: remarks?.trim() || null,
      verifiedBy: adminUserId,
      verifiedAt: new Date().toISOString()
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Suspend an already-approved lawyer. Non-destructive: keep the user row and
// all their data, just block login (users.account_status='suspended') and
// flip lawyer_profiles.verification_status. Reuses verification_remarks /
// verified_by / verified_at to record the actor + reason — last-write-wins
// is acceptable for an FYP audit trail.
export async function suspendLawyerRegistration({ lawyerProfileId, adminUserId, reason }) {
  if (!reason?.trim()) {
    throw new ApiError(400, "Suspension reason is required");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const adminResult = await client.query(
      `SELECT email FROM users WHERE id = $1`,
      [adminUserId]
    );
    const adminEmail = adminResult.rows[0]?.email || null;

    const lookup = await client.query(
      `SELECT
        lawyer_profiles.id,
        lawyer_profiles.user_id,
        lawyer_profiles.verification_status,
        users.email,
        users.first_name,
        users.last_name
      FROM lawyer_profiles
      JOIN users ON users.id = lawyer_profiles.user_id
      WHERE lawyer_profiles.id = $1
      FOR UPDATE OF lawyer_profiles`,
      [lawyerProfileId]
    );

    if (lookup.rowCount === 0) {
      throw new ApiError(404, "Lawyer registration request not found");
    }

    const lawyerProfile = lookup.rows[0];

    if (lawyerProfile.verification_status !== "approved") {
      throw new ApiError(409, "Only approved lawyers can be suspended");
    }

    await client.query(
      `UPDATE lawyer_profiles
      SET verification_status = 'suspended',
          verification_remarks = $1,
          verified_by = $2,
          verified_at = NOW(),
          updated_at = NOW()
      WHERE id = $3`,
      [reason.trim(), adminUserId, lawyerProfile.id]
    );

    await client.query(
      `UPDATE users
      SET account_status = 'suspended',
          updated_at = NOW()
      WHERE id = $1`,
      [lawyerProfile.user_id]
    );

    // Revoke any active refresh sessions so an already-logged-in suspended
    // lawyer is force-logged-out on next refresh.
    await client.query(
      `UPDATE auth_sessions
      SET is_revoked = true,
          revoked_at = NOW()
      WHERE user_id = $1 AND is_revoked = false`,
      [lawyerProfile.user_id]
    );

    await client.query("COMMIT");

    queueLawyerSuspensionEmail({
      email: lawyerProfile.email,
      firstName: lawyerProfile.first_name,
      reason: reason.trim()
    });

    return {
      lawyerProfileId: lawyerProfile.id,
      userId: lawyerProfile.user_id,
      firstName: lawyerProfile.first_name,
      lastName: lawyerProfile.last_name,
      email: lawyerProfile.email,
      verificationStatus: "suspended",
      verificationRemarks: reason.trim(),
      verifiedBy: adminUserId,
      verifiedByEmail: adminEmail,
      verifiedAt: new Date().toISOString()
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Reinstate a suspended lawyer back to approved + active.
export async function reinstateLawyerRegistration({ lawyerProfileId, adminUserId }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lookup = await client.query(
      `SELECT
        lawyer_profiles.id,
        lawyer_profiles.user_id,
        lawyer_profiles.verification_status,
        users.email,
        users.first_name,
        users.last_name
      FROM lawyer_profiles
      JOIN users ON users.id = lawyer_profiles.user_id
      WHERE lawyer_profiles.id = $1
      FOR UPDATE OF lawyer_profiles`,
      [lawyerProfileId]
    );

    if (lookup.rowCount === 0) {
      throw new ApiError(404, "Lawyer registration request not found");
    }

    const lawyerProfile = lookup.rows[0];

    if (lawyerProfile.verification_status !== "suspended") {
      throw new ApiError(409, "Only suspended lawyers can be reinstated");
    }

    await client.query(
      `UPDATE lawyer_profiles
      SET verification_status = 'approved',
          verification_remarks = NULL,
          verified_by = $1,
          verified_at = NOW(),
          updated_at = NOW()
      WHERE id = $2`,
      [adminUserId, lawyerProfile.id]
    );

    await client.query(
      `UPDATE users
      SET account_status = 'active',
          updated_at = NOW()
      WHERE id = $1`,
      [lawyerProfile.user_id]
    );

    await client.query("COMMIT");

    return {
      lawyerProfileId: lawyerProfile.id,
      userId: lawyerProfile.user_id,
      firstName: lawyerProfile.first_name,
      lastName: lawyerProfile.last_name,
      email: lawyerProfile.email,
      verificationStatus: "approved",
      verifiedBy: adminUserId,
      verifiedAt: new Date().toISOString()
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function issueOAuthSession({ userId, req }) {
  const user = await findAuthUserById(userId);

  if (!user) {
    throw new ApiError(500, "Failed to load user after OAuth sign-in");
  }

  // Self-deactivation handling for OAuth users. The upstream
  // Supabase Auth flow has already verified the caller owns the
  // Google account, so successful OAuth is the equivalent of a
  // verified password. Within 30 days the helper returns a
  // reactivation prompt; past 30 days it deletes the row and
  // throws 410.
  if (user.account_status === "inactive" && user.deactivated_at) {
    const recovery = await handleSelfDeactivationRecovery(user);
    if (recovery?.reactivationRequired) {
      return recovery;
    }
  }

  if (user.account_status !== "active") {
    throw new ApiError(403, "Account is not active");
  }

  const tokens = await issueSessionTokens({ user, rememberMe: false, req });

  return {
    user: await mapAuthUser(user),
    ...tokens,
    rememberMe: false
  };
}

const passwordResetExpiryMs = 15 * 60 * 1000;

// SHA-256 of a 256-bit random token is preimage-secure and gives an O(1)
// UNIQUE-indexed lookup. bcrypt's slowness only matters for low-entropy
// secrets (passwords); applying it to a high-entropy reset token forces a
// linear scan and turns the redemption endpoint into a CPU amplifier.
function hashResetToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await findAuthUserByEmail(normalizedEmail);

  // User enumeration protection: caller turns null into the same generic
  // success response as the happy path.
  if (!user) {
    return null;
  }

  // Google-signed-up clients have no local password to reset. Surface a flag
  // so the controller can email them a "continue with Google" notice instead
  // of a reset link — keeping the response shape identical to non-existent
  // users so enumeration is not possible from the outside.
  if (user.auth_provider === "google") {
    return {
      isGoogleUser: true,
      user: await mapAuthUser(user)
    };
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + passwordResetExpiryMs);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Invalidate any still-active tokens for this user before issuing a new
    // one — only the newest email link should work.
    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [user.id]
    );

    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    token,
    user: await mapAuthUser(user)
  };
}

// Authenticated password change: the caller already proved possession of
// the current password (and a valid JWT). Distinct from /reset-password
// which uses an email-delivered token for forgotten-password recovery.
//
// Also clears must_change_password, which is the gate that lets the
// admin-provisioned-registrar flow trust subsequent authenticated requests.
export async function changeAuthenticatedPassword({ userId, currentPassword, newPassword }) {
  if (!newPassword) {
    throw new ApiError(400, "New password is required");
  }

  if (currentPassword && currentPassword === newPassword) {
    throw new ApiError(400, "New password must differ from the current password");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lookup = await client.query(
      `SELECT id, password_hash, auth_provider
      FROM users
      WHERE id = $1
      FOR UPDATE`,
      [userId]
    );

    if (lookup.rowCount === 0) {
      throw new ApiError(404, "User not found");
    }

    const user = lookup.rows[0];

    // Google-only accounts have no local password to change here. They'd
    // manage credentials at the OAuth provider.
    if (user.auth_provider !== "local" || !user.password_hash) {
      throw new ApiError(
        403,
        "This account does not use a local password."
      );
    }

    const currentMatches = await compareHash(currentPassword || "", user.password_hash);
    if (!currentMatches) {
      throw new ApiError(401, "Current password is incorrect");
    }

    const newPasswordHash = await hashValue(newPassword);

    await client.query(
      `UPDATE users
      SET password_hash = $1,
          must_change_password = false,
          failed_login_attempts = 0,
          locked_until = NULL,
          updated_at = NOW()
      WHERE id = $2`,
      [newPasswordHash, userId]
    );

    // Revoke every other active session so a stolen refresh cookie can no
    // longer impersonate the user after they rotate. The caller's current
    // session also gets revoked — the controller re-issues fresh tokens so
    // the legitimate user stays signed in seamlessly.
    await client.query(
      `UPDATE auth_sessions
      SET is_revoked = true,
          revoked_at = NOW()
      WHERE user_id = $1 AND is_revoked = false`,
      [userId]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function resetPassword({ token, password }) {
  const tokenHash = hashResetToken(token);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the token row so a parallel POST with the same token can't
    // double-consume it before we mark it used.
    const lookup = await client.query(
      `SELECT id, user_id, used_at, expires_at
       FROM password_reset_tokens
       WHERE token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    );

    const tokenRow = lookup.rows[0];
    if (!tokenRow || tokenRow.used_at !== null || new Date(tokenRow.expires_at) <= new Date()) {
      throw new ApiError(400, "Reset link is invalid or expired.");
    }

    const newPasswordHash = await hashValue(password);

    await client.query(
      `UPDATE users
       SET password_hash = $1,
           failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [newPasswordHash, tokenRow.user_id]
    );

    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE id = $1`,
      [tokenRow.id]
    );

    // Revoke any still-valid refresh sessions so a stolen-cookie attacker
    // is logged out once the legitimate user resets.
    await client.query(
      `UPDATE auth_sessions
       SET is_revoked = true,
           revoked_at = NOW()
       WHERE user_id = $1 AND is_revoked = false`,
      [tokenRow.user_id]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
