import { randomUUID, timingSafeEqual } from "node:crypto";

import { pool } from "../../config/db.js";
import {
  changeAuthenticatedPassword,
  getCurrentUser,
  issueOAuthSession,
  listActiveLawyerVerifications,
  listLawyerRejectionHistory,
  listPendingLawyerVerifications,
  loginUser,
  logoutUser,
  refreshAuthSession,
  reinstateLawyerRegistration,
  requestPasswordReset,
  resetPassword as resetUserPassword,
  reviewLawyerRegistration,
  suspendLawyerRegistration
} from "./auth.service.js";
import {
  completeOAuthRegistration,
  completeRegistrationVerification,
  resendRegistrationVerificationOtp,
  startRegistration
} from "./registration.service.js";
import {
  queuePasswordResetEmail,
  queuePasswordResetGoogleUserEmail
} from "../../services/email.service.js";
import { parseDurationToMilliseconds } from "../../utils/tokens.js";
import { ApiError } from "../../utils/apiError.js";
import { requireSupabaseClient } from "../../config/supabase.js";

const refreshTokenCookieName = "refreshToken";
const refreshTokenCookiePath = "/";
const oauthStateCookieName = "oauth_state";
const oauthStateMaxAgeMs = 10 * 60 * 1000;

function shouldUseSecureCookies() {
  return process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true";
}

function getRefreshTokenCookieOptions({ rememberMe = false, expiresAt } = {}) {
  const options = {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: process.env.COOKIE_SAME_SITE || "lax",
    path: refreshTokenCookiePath
  };

  if (rememberMe) {
    const expiryDate = expiresAt ? new Date(expiresAt) : null;
    const maxAge = expiryDate
      ? Math.max(expiryDate.getTime() - Date.now(), 0)
      : parseDurationToMilliseconds(process.env.REMEMBER_ME_REFRESH_TOKEN_EXPIRES_IN || process.env.REFRESH_TOKEN_EXPIRES_IN || "7d");

    options.maxAge = maxAge;
    options.expires = expiryDate || new Date(Date.now() + maxAge);
  }

  return options;
}

function setRefreshTokenCookie(res, refreshToken, { rememberMe, expiresAt }) {
  res.cookie(refreshTokenCookieName, refreshToken, getRefreshTokenCookieOptions({
    rememberMe,
    expiresAt
  }));
}

function clearRefreshTokenCookie(res) {
  res.clearCookie(refreshTokenCookieName, {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: process.env.COOKIE_SAME_SITE || "lax",
    path: refreshTokenCookiePath
  });
}

function getOAuthStateCookieOptions() {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: process.env.COOKIE_SAME_SITE || "lax",
    path: refreshTokenCookiePath,
    maxAge: oauthStateMaxAgeMs
  };
}

function clearOAuthStateCookie(res) {
  // clearCookie only needs the cookie identity (name + path + domain) to match
  // the set cookie; Express auto-sets the expiry. Passing maxAge through the
  // set-options helper triggers an Express 5 deprecation warning.
  res.clearCookie(oauthStateCookieName, {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: process.env.COOKIE_SAME_SITE || "lax",
    path: refreshTokenCookiePath
  });
}

function getFrontendUrl() {
  return process.env.FRONTEND_URL || "http://localhost:5173";
}

export async function registerClient(req, res) {
  const result = await startRegistration({
    role: "client",
    payload: req.body
  });

  return res.status(201).json({
    message: "Client registered successfully. Please verify your email.",
    user: result.user,
    verification: result.verification
  });
}

export async function registerLawyer(req, res) {
  const result = await startRegistration({
    role: "lawyer",
    payload: req.body,
    files: req.files
  });

  return res.status(201).json({
    message: "Lawyer registration started successfully. Please verify your email.",
    user: result.user,
    verification: result.verification
  });
}

export async function login(req, res) {
  const result = await loginUser({
    email: req.body.email,
    password: req.body.password,
    rememberMe: req.body.rememberMe === true,
    expectedRole: req.body.expectedRole || null,
    req
  });

  setRefreshTokenCookie(res, result.refreshToken, {
    rememberMe: result.rememberMe,
    expiresAt: result.refreshTokenExpiresAt
  });

  return res.status(200).json({
    message: "Login successful",
    user: result.user,
    accessToken: result.accessToken,
    refreshTokenExpiresAt: result.refreshTokenExpiresAt,
    session: {
      rememberMe: result.rememberMe,
      expiresAt: result.refreshTokenExpiresAt
    }
  });
}

export async function refresh(req, res) {
  const result = await refreshAuthSession({
    refreshToken: req.cookies.refreshToken,
    req
  });

  setRefreshTokenCookie(res, result.refreshToken, {
    rememberMe: result.rememberMe,
    expiresAt: result.refreshTokenExpiresAt
  });

  return res.status(200).json({
    message: "Session refreshed successfully",
    user: result.user,
    accessToken: result.accessToken,
    refreshTokenExpiresAt: result.refreshTokenExpiresAt,
    session: {
      rememberMe: result.rememberMe,
      expiresAt: result.refreshTokenExpiresAt
    }
  });
}

export async function verifyEmail(req, res) {
  const result = await completeRegistrationVerification({
    email: req.body.email,
    otp: req.body.otp
  });

  return res.status(200).json({
    message: "Email verified successfully",
    user: result
  });
}

export async function resendVerificationOtp(req, res) {
  const result = await resendRegistrationVerificationOtp(req.body);

  return res.status(200).json({
    message: "Verification OTP sent successfully",
    verification: result
  });
}

export async function logout(req, res) {
  await logoutUser(req.cookies.refreshToken);
  clearRefreshTokenCookie(res);

  return res.status(200).json({ message: "Logout successful" });
}

export async function me(req, res) {
  const user = await getCurrentUser(req.user.sub);

  return res.status(200).json({ user });
}

export async function reviewLawyer(req, res) {
  const result = await reviewLawyerRegistration({
    lawyerProfileId: req.params.lawyerProfileId,
    adminUserId: req.user.sub,
    status: req.body.status,
    remarks: req.body.remarks
  });

  return res.status(200).json({
    message:
      result.verificationStatus === "approved"
        ? "Lawyer registration approved successfully"
        : "Lawyer registration rejected successfully",
    lawyer: result
  });
}

export async function suspendLawyer(req, res) {
  const result = await suspendLawyerRegistration({
    lawyerProfileId: req.params.lawyerProfileId,
    adminUserId: req.user.sub,
    reason: req.body.reason
  });

  return res.status(200).json({
    message: "Lawyer account suspended successfully",
    lawyer: result
  });
}

export async function reinstateLawyer(req, res) {
  const result = await reinstateLawyerRegistration({
    lawyerProfileId: req.params.lawyerProfileId,
    adminUserId: req.user.sub
  });

  return res.status(200).json({
    message: "Lawyer account reinstated successfully",
    lawyer: result
  });
}

export async function listPendingLawyers(req, res) {
  const result = await listPendingLawyerVerifications({
    limit: req.query.limit,
    offset: req.query.offset
  });

  return res.status(200).json(result);
}

export async function listActiveLawyers(req, res) {
  const result = await listActiveLawyerVerifications({
    limit: req.query.limit,
    offset: req.query.offset
  });

  return res.status(200).json(result);
}

export async function listLawyerRejections(req, res) {
  const result = await listLawyerRejectionHistory({
    limit: req.query.limit,
    offset: req.query.offset,
    search: req.query.search
  });

  return res.status(200).json(result);
}

export async function googleLogin(req, res) {
  const supabase = requireSupabaseClient();

  // Generate our own CSRF state, store it in an httpOnly cookie, and append
  // it as a query param to redirectTo. Supabase preserves redirectTo query
  // params, so the state arrives back in the browser alongside the access
  // token (in the URL hash, since the JS SDK uses implicit flow by default).
  // Supabase redirects straight to the frontend; the frontend reads the hash
  // and POSTs the access token to /google/session for verification.
  const state = randomUUID();
  const callbackUrl = new URL("/auth/callback", getFrontendUrl());
  callbackUrl.searchParams.set("state", state);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString()
    }
  });

  if (error || !data?.url) {
    throw new ApiError(502, "Failed to start Google sign-in");
  }

  res.cookie(oauthStateCookieName, state, getOAuthStateCookieOptions());
  return res.redirect(data.url);
}

function safeEqualString(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

// Cascades a Supabase auth.users deletion into the LawFlow database.
// Install the Postgres trigger from Backend/src/models/supabase_auth_users_delete_webhook.sql
// in the Supabase SQL Editor (replacing the URL/secret placeholders). The
// trigger POSTs to this endpoint on every auth.users DELETE.
export async function supabaseAuthWebhook(req, res) {
  const expectedSecret = process.env.SUPABASE_WEBHOOK_SECRET;

  if (!expectedSecret) {
    throw new ApiError(503, "Webhook is not configured on this server");
  }

  const provided = req.headers["x-webhook-secret"];

  if (!safeEqualString(provided, expectedSecret)) {
    throw new ApiError(401, "Invalid webhook signature");
  }

  const event = req.body || {};
  const isAuthUserDelete =
    event.type === "DELETE" &&
    event.schema === "auth" &&
    event.table === "users";

  if (!isAuthUserDelete) {
    return res.status(200).json({ received: true, processed: false, reason: "event ignored" });
  }

  const supabaseUserId = event.old_record?.id;

  if (!supabaseUserId) {
    return res.status(200).json({ received: true, processed: false, reason: "missing user id" });
  }

  // Match by the Supabase user id stored in auth_identities. Per AGENTS.md
  // we never look up OAuth users by email — Supabase can recycle an email
  // address across distinct auth.users rows, and matching by email would
  // risk wiping an unrelated local account.
  const result = await pool.query(
    `DELETE FROM users
    WHERE id = (
      SELECT user_id FROM auth_identities
      WHERE provider = 'google' AND provider_user_id = $1
      LIMIT 1
    )
    RETURNING id, email`,
    [supabaseUserId]
  );

  return res.status(200).json({
    received: true,
    processed: true,
    deletedCount: result.rowCount,
    deleted: result.rows
  });
}

export async function googleSession(req, res) {
  const { accessToken, state } = req.body;
  const cookieState = req.cookies[oauthStateCookieName];

  // Always clear the state cookie regardless of outcome.
  clearOAuthStateCookie(res);

  if (!accessToken || typeof accessToken !== "string") {
    throw new ApiError(400, "Access token is required");
  }

  if (!state || !cookieState || cookieState !== state) {
    throw new ApiError(403, "Invalid OAuth state");
  }

  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data?.user?.email) {
    throw new ApiError(401, "Invalid Google access token");
  }

  const supabaseUser = data.user;

  const { userId } = await completeOAuthRegistration({
    provider: "google",
    providerUserId: supabaseUser.id,
    providerEmail: supabaseUser.email,
    fullName: supabaseUser.user_metadata?.full_name
  });

  const session = await issueOAuthSession({ userId, req });

  setRefreshTokenCookie(res, session.refreshToken, {
    rememberMe: session.rememberMe,
    expiresAt: session.refreshTokenExpiresAt
  });

  return res.status(200).json({
    user: session.user,
    accessToken: session.accessToken,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt
  });
}

export async function forgotPassword(req, res) {
  const result = await requestPasswordReset(req.body.email);

  // result is null when the user does not exist — silent no-op so an attacker
  // cannot enumerate registered emails via response shape or timing.
  if (result?.isGoogleUser) {
    queuePasswordResetGoogleUserEmail({
      email: result.user.email,
      firstName: result.user.firstName
    });
  } else if (result) {
    const { token, user } = result;
    const resetUrl = `${getFrontendUrl()}/reset-password?token=${token}`;

    queuePasswordResetEmail({
      email: user.email,
      firstName: user.firstName,
      resetUrl
    });
  }

  // Always return the same generic message regardless of whether the email
  // exists, is local, or is Google — preserves enumeration protection.
  return res.status(200).json({
    message: "If an account exists, a reset link has been sent."
  });
}

export async function resetPassword(req, res) {
  await resetUserPassword({
    token: req.body.token,
    password: req.body.password
  });

  return res.status(200).json({
    message: "Password has been reset successfully. Please log in with your new password."
  });
}

export async function changePassword(req, res) {
  await changeAuthenticatedPassword({
    userId: req.user.sub,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword
  });

  // Clear the refresh cookie. The user's old session was revoked inside the
  // service to invalidate any stolen refresh tokens; the frontend should
  // re-authenticate with the new password to get a fresh session.
  clearRefreshTokenCookie(res);

  return res.status(200).json({
    message: "Password changed successfully. Please sign in again with your new password."
  });
}
