import { pool } from "../../config/db.js";
import { queueLawyerRegistrationDecisionEmail } from "../../services/email.service.js";
import {
  deleteLawyerDocuments,
  deleteLawyerStorageFolder,
  getLawyerDocumentSignedUrl
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
      users.email_verified,
      users.account_status,
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

async function createAuthSession({ userId, refreshToken, refreshTokenDuration, req }) {
  const refreshTokenHash = await hashValue(refreshToken);
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
  const result = await pool.query(
    `SELECT id, refresh_token_hash, expires_at, is_revoked
    FROM auth_sessions
    WHERE user_id = $1
      AND is_revoked = false
      AND expires_at > NOW()
    ORDER BY created_at DESC`,
    [userId]
  );

  for (const session of result.rows) {
    const matches = await compareHash(refreshToken, session.refresh_token_hash);

    if (matches) {
      return session;
    }
  }

  return null;
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

export async function loginUser({ email, password, rememberMe = false, req }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await findAuthUserByEmail(normalizedEmail);

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    throw new ApiError(423, "Account is temporarily locked. Please try again later");
  }

  const passwordMatches = await compareHash(password, user.password_hash);

  if (!passwordMatches) {
    await recordFailedLogin(user);
    throw new ApiError(401, "Invalid password. Please try again.");
  }

  if (!user.email_verified) {
    throw new ApiError(403, "Please verify your email before logging in");
  }

  if (user.role === "lawyer" && user.lawyer_verification_status !== "approved") {
    throw new ApiError(403, "Your lawyer account is pending admin approval");
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

export async function listPendingLawyerVerifications({ limit = 20, offset = 0 } = {}) {
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
    WHERE lawyer_profiles.verification_status = 'pending'
    ORDER BY lawyer_profiles.created_at ASC
    LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset]
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

// Best-effort folder-level cleanup: parses one of the storage_paths to
// extract the {lawyerKey} segment and removes the whole lawyers/{key}/
// folder. Falls back to the explicit list if parsing fails.
function deriveLawyerKey(storagePaths) {
  for (const p of storagePaths) {
    const match = /^lawyers\/([^/]+)\//.exec(p);
    if (match) return match[1];
  }
  return null;
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

    const adminResult = await client.query(
      `SELECT users.id, users.email, roles.name AS role
      FROM users
      JOIN roles ON roles.id = users.role_id
      WHERE users.id = $1`,
      [adminUserId]
    );

    if (adminResult.rowCount === 0) {
      throw new ApiError(404, "Admin user not found");
    }

    if (adminResult.rows[0].role !== "admin") {
      throw new ApiError(403, "Only admin can review lawyer registrations");
    }

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
      WHERE lawyer_profiles.id = $1`,
      [lawyerProfileId]
    );

    if (lawyerProfileResult.rowCount === 0) {
      throw new ApiError(404, "Lawyer registration request not found");
    }

    const lawyerProfile = lawyerProfileResult.rows[0];
    const adminEmail = adminResult.rows[0].email;

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
    const lawyerKey = deriveLawyerKey(storagePaths);
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
      emailVerified: true,
      accountStatus: "deleted",
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
