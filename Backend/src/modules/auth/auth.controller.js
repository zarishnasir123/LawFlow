import {
  getCurrentUser,
  listPendingLawyerVerifications,
  loginUser,
  logoutUser,
  refreshAuthSession,
  reviewLawyerRegistration,
  syncOAuthUser,
} from "./auth.service.js";
import {
  completeRegistrationVerification,
  resendRegistrationVerificationOtp,
  startRegistration
} from "./registration.service.js";
import { parseDurationToMilliseconds } from "../../utils/tokens.js";
import { supabase } from "../../config/supabase.js";

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

export async function listPendingLawyers(req, res) {
  const result = await listPendingLawyerVerifications({
    limit: req.query.limit,
    offset: req.query.offset
  });

  return res.status(200).json(result);
}


export async function googleLogin(req, res) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "http://localhost:5000/auth/google/callback"
    }
  });

  if (error) {
    return res.status(500).json({ message: error.message });
  }

  return res.redirect(data.url);
}

export async function googleCallback(req, res) {
  console.log("FULL CALLBACK QUERY:", req.query);
  const { code } = req.query;

  if (!code) {
    console.error("No code provided in Google callback");
    return res.redirect("http://localhost:5173/client-dashboard?error=no_code");
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Supabase OAuth error:", error.message);
    return res.redirect("http://localhost:5173/client-dashboard?error=auth_failed");
  }

  console.log("Supabase session obtained for user:", data.session.user.email);

  const { user } = data.session;

  try {
    const syncedUser = await syncOAuthUser({
      supabaseUserId: user.id,
      email: user.email,
      firstName: user.user_metadata.full_name?.split(" ")[0] || user.email.split("@")[0],
      lastName: user.user_metadata.full_name?.split(" ").slice(1).join(" ") || "",
      provider: "google"
    });

    console.log("User successfully synced to database:", syncedUser.email);
    return res.redirect("http://localhost:5173/client-dashboard");
  } catch (syncError) {
    console.error("User sync error detail:", syncError);
    return res.redirect("http://localhost:5173/client-dashboard?error=sync_failed");
  }
}