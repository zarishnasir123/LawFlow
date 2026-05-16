import type { LoginRole } from "../types";

const authUserStorageKey = "user";

export type StoredAuthUser = {
  id?: string;
  email: string;
  role: LoginRole;
  name?: string;
  rememberMe?: boolean;
  refreshTokenExpiresAt?: string;
};

// Access tokens live in memory only. XSS in a third-party script or in
// user-supplied content can read anything in localStorage, but cannot
// reach into a module-level closure variable. Refresh tokens stay in an
// httpOnly cookie (see auth.controller.js setRefreshTokenCookie) — on
// page reload the in-memory token is gone, the first protected request
// returns 401, the response interceptor calls /auth/refresh against the
// cookie, populates this variable, and retries the original request.
let inMemoryAccessToken: string | null = null;

export function getInMemoryAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setInMemoryAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

// Cross-tab sync: when another tab logs out or switches user (mutating the
// "user" key in localStorage), drop our cached access token so the next
// request falls through to the refresh interceptor with whatever cookie
// the other tab left behind.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === authUserStorageKey) {
      inMemoryAccessToken = null;
    }
  });
}

function parseStoredUser(value: string | null): StoredAuthUser | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as StoredAuthUser;
  } catch {
    return null;
  }
}

export function getStoredAuthUser() {
  return (
    parseStoredUser(sessionStorage.getItem(authUserStorageKey)) ??
    parseStoredUser(localStorage.getItem(authUserStorageKey))
  );
}

export function saveStoredAuthUser(
  user: StoredAuthUser,
  rememberMe: boolean,
  accessToken?: string
) {
  const storage = rememberMe ? localStorage : sessionStorage;

  localStorage.removeItem(authUserStorageKey);
  sessionStorage.removeItem(authUserStorageKey);

  storage.setItem(authUserStorageKey, JSON.stringify({ ...user, rememberMe }));

  if (accessToken !== undefined) {
    inMemoryAccessToken = accessToken;
  }
}

export function clearStoredAuth() {
  localStorage.removeItem(authUserStorageKey);
  sessionStorage.removeItem(authUserStorageKey);
  inMemoryAccessToken = null;
}
