import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../../../shared/api/axios";
import type { LoginRole } from "../types";

// The logged-in admin's own account, as returned by GET /auth/me. Trimmed to
// the fields the admin panel actually renders — admins live entirely in the
// `users` table (no client/lawyer/registrar profile rows), so the role-specific
// fields the client app surfaces are irrelevant here.
export type CurrentUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  cnic: string | null;
  role: LoginRole;
  // ISO timestamp of when the account was created (users.created_at). Rendered
  // as "Member since <date>".
  createdAt: string;
  // Signed URL to the uploaded profile picture, with a ?v=<timestamp> cache-
  // buster appended on every change so the browser fetches the new image. Null
  // when no picture is set — the UI falls back to an initials circle.
  avatarUrl: string | null;
  emailVerified: boolean;
  accountStatus: string;
  // 'local' for password accounts, 'google' for OAuth. The admin is always
  // 'local'; we keep the field so the Change Password button can defend against
  // a (theoretical) Google account.
  authProvider: "local" | "google" | null;
};

// Fetches the current authenticated admin via GET /api/auth/me. Shared cache
// key ["currentUser"] so the profile page, header card, and sidebar chip all
// read/update the same source.
export function useCurrentUser() {
  return useQuery<CurrentUser>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ user: CurrentUser }>("/auth/me");
      return data.user;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

// Render-ready full name with sensible fallbacks: "First Last" if both present;
// otherwise whichever is non-empty; otherwise the email handle, title-cased.
export function displayFullName(user: CurrentUser | undefined | null): string {
  if (!user) return "";
  const first = user.firstName?.trim() ?? "";
  const last = user.lastName?.trim() ?? "";
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  const handle = user.email.split("@")[0] ?? "";
  return handle
    .replace(/[._-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// Single-letter initial for the avatar fallback circle.
export function avatarInitial(user: CurrentUser | undefined | null): string {
  const name = displayFullName(user);
  return name ? name.charAt(0).toUpperCase() : "A";
}
