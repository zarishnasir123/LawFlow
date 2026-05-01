import { pool } from "../../config/db.js";
import {
  queueVerificationOtpEmail,
  queueWelcomeEmail
} from "../../services/email.service.js";
import { ApiError } from "../../utils/apiError.js";
import { normalizeCnic } from "../../utils/cnic.js";
import { compareHash, hashValue } from "../../utils/hash.js";
import { generateNumericOtp, getEmailOtpExpiryDate } from "../../utils/otp.js";
import {
  getRefreshTokenDuration,
  getRefreshTokenExpiryDate,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../../utils/tokens.js";

const maxFailedLoginAttempts = 5;
const lockDurationMinutes = 15;

async function getRoleId(client, roleName) {
  const result = await client.query(
    "SELECT id FROM roles WHERE name = $1",
    [roleName]
  );

  if (result.rowCount === 0) {
    throw new ApiError(500, `Required role is missing: ${roleName}`);
  }

  return result.rows[0].id;
}

async function ensureUniqueUserIdentity(client, { email, cnic }) {
  const result = await client.query(
    "SELECT email, cnic FROM users WHERE email = $1 OR cnic = $2 LIMIT 1",
    [email, cnic]
  );

  if (result.rowCount === 0) {
    return;
  }

  const existingUser = result.rows[0];

  if (existingUser.email === email) {
    throw new ApiError(409, "Email is already registered");
  }

  throw new ApiError(409, "CNIC is already registered");
}

async function createEmailVerificationOtp(client, userId) {
  const otp = generateNumericOtp();
  const otpHash = await hashValue(otp);
  const expiresAt = getEmailOtpExpiryDate();

  // Only one active email verification OTP should exist per user.
  await client.query(
    `UPDATE email_verification_otps
    SET used_at = NOW()
    WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );

  await client.query(
    `INSERT INTO email_verification_otps (user_id, otp_hash, expires_at)
    VALUES ($1, $2, $3)`,
    [userId, otpHash, expiresAt]
  );

  return { otp, expiresAt };
}

async function findUserByEmail(client, email) {
  const result = await client.query(
    `SELECT id, first_name, email, email_verified, account_status
    FROM users
    WHERE email = $1`,
    [email]
  );

  return result.rows[0] || null;
}

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
    accountStatus: row.account_status
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
      roles.name AS role
    FROM users
    JOIN roles ON roles.id = users.role_id
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
      roles.name AS role
    FROM users
    JOIN roles ON roles.id = users.role_id
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

export async function registerClientAccount(payload) {
  const client = await pool.connect();
  let verificationOtp = null;
  let createdUser = null;

  try {
    await client.query("BEGIN");

    const email = payload.email.trim().toLowerCase();
    const cnic = normalizeCnic(payload.cnic);

    await ensureUniqueUserIdentity(client, { email, cnic });

    const clientRoleId = await getRoleId(client, "client");
    const passwordHash = await hashValue(payload.password);

    const userResult = await client.query(
      `INSERT INTO users (
        role_id,
        first_name,
        last_name,
        email,
        phone,
        cnic,
        password_hash,
        auth_provider,
        email_verified,
        account_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'local', false, 'pending_verification')
      RETURNING id, first_name, last_name, email, phone, cnic, account_status, created_at`,
      [
        clientRoleId,
        payload.firstName.trim(),
        payload.lastName.trim(),
        email,
        payload.phone.trim(),
        cnic,
        passwordHash
      ]
    );

    const user = userResult.rows[0];

    // Keep client-only details outside users so auth identity stays role-neutral.
    await client.query(
      `INSERT INTO client_profiles (user_id, address, city, tehsil)
      VALUES ($1, $2, $3, $4)`,
      [
        user.id,
        payload.address?.trim() || null,
        payload.city?.trim() || null,
        payload.tehsil?.trim() || null
      ]
    );

    verificationOtp = await createEmailVerificationOtp(client, user.id);

    await client.query("COMMIT");

    createdUser = {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone: user.phone,
      cnic: user.cnic,
      role: "client",
      emailVerified: false,
      accountStatus: user.account_status,
      createdAt: user.created_at
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw new ApiError(409, "Email or CNIC is already registered");
    }

    throw error;
  } finally {
    client.release();
  }

  const emailDelivery = queueVerificationOtpEmail({
    email: createdUser.email,
    otp: verificationOtp.otp,
    firstName: createdUser.firstName
  });

  return {
    user: createdUser,
    verification: {
      emailSent: emailDelivery.mode === "smtp",
      emailQueued: emailDelivery.queued,
      deliveryMode: emailDelivery.mode,
      deliveryReason: emailDelivery.reason,
      expiresAt: verificationOtp.expiresAt
    }
  };
}

export async function verifyEmailOtp({ email, otp }) {
  const normalizedEmail = email.trim().toLowerCase();
  const client = await pool.connect();
  let verifiedUser = null;
  let shouldSendWelcomeEmail = false;

  try {
    await client.query("BEGIN");

    const user = await findUserByEmail(client, normalizedEmail);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (user.email_verified) {
      await client.query("COMMIT");
      return {
        email: user.email,
        emailVerified: true,
        accountStatus: user.account_status
      };
    }

    const otpResult = await client.query(
      `SELECT id, otp_hash, expires_at
      FROM email_verification_otps
      WHERE user_id = $1 AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
      [user.id]
    );

    if (otpResult.rowCount === 0) {
      throw new ApiError(400, "No active verification OTP found");
    }

    const otpRecord = otpResult.rows[0];

    if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
      throw new ApiError(400, "Verification OTP has expired");
    }

    const otpMatches = await compareHash(otp, otpRecord.otp_hash);

    if (!otpMatches) {
      throw new ApiError(400, "Invalid verification OTP");
    }

    await client.query(
      "UPDATE email_verification_otps SET used_at = NOW() WHERE id = $1",
      [otpRecord.id]
    );

    await client.query(
      `UPDATE users
      SET email_verified = true,
          account_status = 'active',
          updated_at = NOW()
      WHERE id = $1`,
      [user.id]
    );

    await client.query("COMMIT");

    verifiedUser = user;
    shouldSendWelcomeEmail = true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (shouldSendWelcomeEmail) {
    queueWelcomeEmail({
      email: verifiedUser.email,
      firstName: verifiedUser.first_name
    });
  }

  return {
    email: verifiedUser.email,
    emailVerified: true,
    accountStatus: "active"
  };
}

export async function resendEmailVerificationOtp({ email }) {
  const normalizedEmail = email.trim().toLowerCase();
  const client = await pool.connect();
  let user = null;
  let verificationOtp = null;

  try {
    await client.query("BEGIN");

    user = await findUserByEmail(client, normalizedEmail);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (user.email_verified) {
      throw new ApiError(400, "Email is already verified");
    }

    verificationOtp = await createEmailVerificationOtp(client, user.id);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const emailDelivery = queueVerificationOtpEmail({
    email: user.email,
    otp: verificationOtp.otp,
    firstName: user.first_name
  });

  return {
    email: user.email,
    emailSent: emailDelivery.mode === "smtp",
    emailQueued: emailDelivery.queued,
    deliveryMode: emailDelivery.mode,
    deliveryReason: emailDelivery.reason,
    expiresAt: verificationOtp.expiresAt
  };
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
