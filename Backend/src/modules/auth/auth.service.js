import { createHash, randomBytes } from "node:crypto";
import { pool } from "../../config/db.js";
import {
  queueLawyerRegistrationDecisionEmail,
  queueLawyerSuspensionEmail
} from "../../services/email.service.js";
import {
  deleteLawyerDocuments,
  deleteLawyerStorageFolder,
  getLawyerDocumentSignedUrl,
  parseLawyerKeyFromStoragePath
} from "../../services/storage.service.js";
import { ApiError } from "../../utils/apiError.js";
import { compareHash, hashValue } from "../../utils/hash.js";
import {
  getRefreshTokenDuration,
  getRefreshTokenExpiryDate,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../../utils/tokens.js";

const maxFailedLoginAttempts = 5;
const lockDurationMinutes = 15;

function mapAuthUser(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    cnic: row.cnic,
    role: row.role,
    emailVerified: row.email_verified,
    accountStatus: row.account_status,
    // Surfaced so the frontend can gate every authenticated screen behind a
    // password-change prompt for admin-provisioned accounts. Defaults to
    // false for users who registered themselves (and so chose their own
    // password). Set true by the registrar create/resend-credentials flow.
    mustChangePassword: row.must_change_password === true,
    lawyerVerificationStatus: row.lawyer_verification_status || null
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
    consultationFee: row.consultation_fee !== null && row.consultation_fee !== undefined
      ? Number(row.consultation_fee)
      : null,
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
      users.must_change_password,
      roles.name AS role,
      lawyer_profiles.verification_status AS lawyer_verification_status
    FROM users
    JOIN roles ON roles.id = users.role_id
    LEFT JOIN lawyer_profiles ON lawyer_profiles.user_id = users.id
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

  // A freshly registered lawyer awaiting admin approval has
  // account_status='inactive' (set in registration.service.js). For lawyers
  // we let the flow fall through so the dedicated "pending admin approval"
  // message below fires — much friendlier than the generic inactive one.
  // For non-lawyers, account_status='inactive' is a real deactivation.
  if (user.account_status === "inactive" && user.role !== "lawyer") {
    throw new ApiError(403, "Your account is inactive. Contact support.");
  }

  const passwordMatches = await compareHash(password, user.password_hash);

  if (!passwordMatches) {
    await recordFailedLogin(user);
    throw new ApiError(401, "Invalid password. Please try again.");
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
    user: mapAuthUser(user),
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
    user: mapAuthUser(user),
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

export async function getCurrentUser(userId) {
  const user = await findAuthUserById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return mapAuthUser(user);
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
      lawyer_profiles.consultation_fee,
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

  if (user.account_status !== "active") {
    throw new ApiError(403, "Account is not active");
  }

  const tokens = await issueSessionTokens({ user, rememberMe: false, req });

  return {
    user: mapAuthUser(user),
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
      user: mapAuthUser(user)
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
    user: mapAuthUser(user)
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
