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

const pendingClientRegistrations = new Map();

function getPendingClientRegistration(email, { allowExpired = false } = {}) {
  const normalizedEmail = email.trim().toLowerCase();
  const pendingRegistration = pendingClientRegistrations.get(normalizedEmail);

  if (!pendingRegistration) {
    return null;
  }

  const isExpired = new Date(pendingRegistration.expiresAt).getTime() < Date.now();

  if (isExpired && !allowExpired) {
    return null;
  }

  return pendingRegistration;
}

function removeExpiredPendingClientRegistrations() {
  for (const [email, pendingRegistration] of pendingClientRegistrations.entries()) {
    if (new Date(pendingRegistration.expiresAt).getTime() < Date.now()) {
      pendingClientRegistrations.delete(email);
    }
  }
}

function findPendingClientRegistrationByCnic(cnic) {
  removeExpiredPendingClientRegistrations();

  for (const pendingRegistration of pendingClientRegistrations.values()) {
    if (pendingRegistration.cnic === cnic) {
      return pendingRegistration;
    }
  }

  return null;
}

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
  const email = payload.email.trim().toLowerCase();
  const cnic = normalizeCnic(payload.cnic);

  const client = await pool.connect();

  try {
    await ensureUniqueUserIdentity(client, { email, cnic });
  } finally {
    client.release();
  }

  const pendingRegistrationWithSameCnic = findPendingClientRegistrationByCnic(cnic);

  if (pendingRegistrationWithSameCnic && pendingRegistrationWithSameCnic.email !== email) {
    throw new ApiError(409, "CNIC is already being registered. Please verify the pending email first.");
  }

  const otp = generateNumericOtp();
  const otpHash = await hashValue(otp);
  const expiresAt = getEmailOtpExpiryDate();
  const passwordHash = await hashValue(payload.password);

  const pendingRegistration = {
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    email,
    phone: payload.phone.trim(),
    cnic,
    passwordHash,
    address: payload.address?.trim() || null,
    city: payload.city?.trim() || null,
    tehsil: payload.tehsil?.trim() || null,
    otpHash,
    expiresAt,
    createdAt: new Date()
  };

  pendingClientRegistrations.set(email, pendingRegistration);

  const emailDelivery = queueVerificationOtpEmail({
    email,
    otp,
    firstName: pendingRegistration.firstName
  });

  return {
    user: {
      id: null,
      firstName: pendingRegistration.firstName,
      lastName: pendingRegistration.lastName,
      email: pendingRegistration.email,
      phone: pendingRegistration.phone,
      cnic: pendingRegistration.cnic,
      role: "client",
      emailVerified: false,
      accountStatus: "pending_verification",
      createdAt: pendingRegistration.createdAt
    },
    verification: {
      emailSent: emailDelivery.mode === "smtp",
      emailQueued: emailDelivery.queued,
      deliveryMode: emailDelivery.mode,
      deliveryReason: emailDelivery.reason,
      expiresAt
    }
  };
}

export async function verifyEmailOtp({ email, otp }) {
  const normalizedEmail = email.trim().toLowerCase();
  const pendingRegistration = getPendingClientRegistration(normalizedEmail);

  if (!pendingRegistration) {
    const client = await pool.connect();

    try {
      const existingUser = await findUserByEmail(client, normalizedEmail);

      if (existingUser?.email_verified) {
        return {
          email: existingUser.email,
          emailVerified: true,
          accountStatus: existingUser.account_status
        };
      }
    } finally {
      client.release();
    }

    throw new ApiError(400, "OTP expired. Please register again.");
  }

  const otpMatches = await compareHash(otp, pendingRegistration.otpHash);

  if (!otpMatches) {
    throw new ApiError(400, "Invalid verification OTP");
  }

  const client = await pool.connect();
  let verifiedUser = null;

  try {
    await client.query("BEGIN");

    await ensureUniqueUserIdentity(client, {
      email: pendingRegistration.email,
      cnic: pendingRegistration.cnic
    });

    const clientRoleId = await getRoleId(client, "client");

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
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'local', true, 'active')
      RETURNING id, first_name, last_name, email, phone, cnic, email_verified, account_status, created_at`,
      [
        clientRoleId,
        pendingRegistration.firstName,
        pendingRegistration.lastName,
        pendingRegistration.email,
        pendingRegistration.phone,
        pendingRegistration.cnic,
        pendingRegistration.passwordHash
      ]
    );

    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO client_profiles (user_id, address, city, tehsil)
      VALUES ($1, $2, $3, $4)`,
      [
        user.id,
        pendingRegistration.address,
        pendingRegistration.city,
        pendingRegistration.tehsil
      ]
    );

    await client.query("COMMIT");

    verifiedUser = user;
    pendingClientRegistrations.delete(normalizedEmail);
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw new ApiError(409, "Email or CNIC is already registered");
    }

    throw error;
  } finally {
    client.release();
  }

  queueWelcomeEmail({
    email: verifiedUser.email,
    firstName: verifiedUser.first_name
  });

  return {
    id: verifiedUser.id,
    firstName: verifiedUser.first_name,
    lastName: verifiedUser.last_name,
    email: verifiedUser.email,
    phone: verifiedUser.phone,
    cnic: verifiedUser.cnic,
    role: "client",
    emailVerified: verifiedUser.email_verified,
    accountStatus: verifiedUser.account_status,
    createdAt: verifiedUser.created_at
  };
}

export async function resendEmailVerificationOtp({ email }) {
  const normalizedEmail = email.trim().toLowerCase();
  const pendingRegistration = getPendingClientRegistration(normalizedEmail, {
    allowExpired: true
  });

  if (!pendingRegistration) {
    throw new ApiError(400, "Registration session expired. Please register again.");
  }

  const otp = generateNumericOtp();
  const otpHash = await hashValue(otp);
  const expiresAt = getEmailOtpExpiryDate();

  pendingRegistration.otpHash = otpHash;
  pendingRegistration.expiresAt = expiresAt;

  pendingClientRegistrations.set(normalizedEmail, pendingRegistration);

  const emailDelivery = queueVerificationOtpEmail({
    email: pendingRegistration.email,
    otp,
    firstName: pendingRegistration.firstName
  });

  return {
    email: pendingRegistration.email,
    emailSent: emailDelivery.mode === "smtp",
    emailQueued: emailDelivery.queued,
    deliveryMode: emailDelivery.mode,
    deliveryReason: emailDelivery.reason,
    expiresAt
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
