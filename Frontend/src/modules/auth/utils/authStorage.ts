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

export function saveStoredAuthUser(user: StoredAuthUser, rememberMe: boolean) {
  const storage = rememberMe ? localStorage : sessionStorage;

  localStorage.removeItem(authUserStorageKey);
  sessionStorage.removeItem(authUserStorageKey);
  storage.setItem(authUserStorageKey, JSON.stringify({ ...user, rememberMe }));
}
