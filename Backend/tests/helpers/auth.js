import { signAccessToken } from "../../src/utils/tokens.js";

// Mint an access token exactly the way the app does (same payload shape:
// { sub, role, rememberMe }) so tokens can never drift from production.
export function tokenFor(user) {
  return signAccessToken({ sub: user.id, role: user.role, rememberMe: false });
}

export function authHeader(user) {
  return { Authorization: `Bearer ${tokenFor(user)}` };
}
