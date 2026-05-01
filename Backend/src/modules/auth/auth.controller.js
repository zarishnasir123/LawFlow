import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerClientAccount,
  resendEmailVerificationOtp,
  refreshAuthSession,
  verifyEmailOtp
} from "./auth.service.js";
import { parseDurationToMilliseconds } from "../../utils/tokens.js";

const refreshTokenCookieName = "refreshToken";
const refreshTokenCookiePath = "/";

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

export async function registerClient(req, res) {
  const result = await registerClientAccount(req.body);

  return res.status(201).json({
    message: "Client registered successfully. Please verify your email.",
    user: result.user,
    verification: result.verification
  });
}

export function registerLawyer(req, res) {
  return res.status(501).json({ message: "Lawyer registration is not implemented yet" });
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

export async function login(req, res) {
  const result = await loginUser({
    email: req.body.email,
    password: req.body.password,
    rememberMe: req.body.rememberMe === true,
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
  const result = await verifyEmailOtp(req.body);

  return res.status(200).json({
    message: "Email verified successfully",
    user: result
  });
}

export async function resendVerificationOtp(req, res) {
  const result = await resendEmailVerificationOtp(req.body);

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
