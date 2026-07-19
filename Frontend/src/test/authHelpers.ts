import { saveStoredAuthUser, type StoredAuthUser } from "../modules/auth/utils/authStorage";

// Seed a logged-in user into storage + the in-memory access token so a
// component that reads the current user renders as authenticated.
export function seedAuthUser(over: Partial<StoredAuthUser> = {}, token = "test-token") {
  const user: StoredAuthUser = {
    id: "u1",
    email: "test@lawflow.pk",
    role: "client",
    ...over,
  };
  saveStoredAuthUser(user, true, token);
  return user;
}
