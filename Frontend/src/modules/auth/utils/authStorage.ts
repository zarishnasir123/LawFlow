import type { LoginRole } from "../types";

const authUserStorageKey = "user";
const accessTokenStorageKey = "lawflow_access_token";

export type StoredAuthUser = {
  id?: string;
  email: string;
  role: LoginRole;
  name?: string;
  rememberMe?: boolean;
  refreshTokenExpiresAt?: string;
};

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

export function getStoredAccessToken() {
  return (
    sessionStorage.getItem(accessTokenStorageKey) ??
    localStorage.getItem(accessTokenStorageKey)
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
  localStorage.removeItem(accessTokenStorageKey);
  sessionStorage.removeItem(accessTokenStorageKey);

  storage.setItem(authUserStorageKey, JSON.stringify({ ...user, rememberMe }));

  if (accessToken) {
    storage.setItem(accessTokenStorageKey, accessToken);
  }
}

export function clearStoredAuth() {
  localStorage.removeItem(authUserStorageKey);
  sessionStorage.removeItem(authUserStorageKey);
  localStorage.removeItem(accessTokenStorageKey);
  sessionStorage.removeItem(accessTokenStorageKey);
}
