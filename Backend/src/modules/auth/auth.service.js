import { pool } from "../../config/db.js";
import { queueLawyerRegistrationDecisionEmail } from "../../services/email.service.js";
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

  return {
    user: mapAuthUser(user),
    accessToken,
    refreshToken,
    refreshTokenExpiresAt,
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
  const tokenPayload = {
    sub: user.id,
    role: user.role,
    rememberMe
  };
  const refreshTokenDuration = getRefreshTokenDuration(rememberMe);
  const newAccessToken = signAccessToken(tokenPayload);
  const newRefreshToken = signRefreshToken(tokenPayload, refreshTokenDuration);
  const refreshTokenExpiresAt = await createAuthSession({
    userId: user.id,
    refreshToken: newRefreshToken,
    refreshTokenDuration,
    req
  });

  return {
    user: mapAuthUser(user),
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    refreshTokenExpiresAt,
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
      `SELECT users.id, roles.name AS role
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
        users.email,
        users.first_name,
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
    const nextAccountStatus = status === "approved" ? "active" : "inactive";

    const updatedProfileResult = await client.query(
      `UPDATE lawyer_profiles
      SET verification_status = $1,
          verification_remarks = $2,
          verified_by = $3,
          verified_at = NOW(),
          updated_at = NOW()
      WHERE id = $4
      RETURNING id, user_id, verification_status, verification_remarks, verified_by, verified_at`,
      [
        status,
        remarks?.trim() || null,
        adminUserId,
        lawyerProfileId
      ]
    );

    const updatedUserResult = await client.query(
      `UPDATE users
      SET account_status = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING id, first_name, last_name, email, account_status, email_verified`,
      [nextAccountStatus, lawyerProfile.user_id]
    );

    await client.query("COMMIT");

    const updatedProfile = updatedProfileResult.rows[0];
    const updatedUser = updatedUserResult.rows[0];

    queueLawyerRegistrationDecisionEmail({
      email: updatedUser.email,
      firstName: updatedUser.first_name,
      status,
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
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
