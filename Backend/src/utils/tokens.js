import jwt from "jsonwebtoken";

const durationPattern = /^(\d+)([smhd])$/;

export function parseDurationToMilliseconds(duration, fallback = "7d") {
  const value = duration || fallback;
  const match = durationPattern.exec(value);

  if (!match) {
    throw new Error(`Invalid token duration: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return amount * multipliers[unit];
}

export function getRefreshTokenDuration(rememberMe = false) {
  if (rememberMe) {
    return process.env.REMEMBER_ME_REFRESH_TOKEN_EXPIRES_IN
      || process.env.REFRESH_TOKEN_EXPIRES_IN
      || "7d";
  }

  return process.env.SESSION_REFRESH_TOKEN_EXPIRES_IN || "8h";
}

export function getRefreshTokenExpiryDate(duration = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d") {
  return new Date(Date.now() + parseDurationToMilliseconds(duration));
}


export function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m"
  });
}

export function signRefreshToken(payload, expiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d") {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}
