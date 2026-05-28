import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../../../shared/api/axios";
import type { LoginRole } from "../types";

export type CurrentUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  cnic: string | null;
  role: LoginRole;
  // Client location. All three live on client_profiles, surfaced
  // here via the /auth/me JOIN. Null for non-client roles and for
  // clients who haven't filled them in yet — the client profile
  // page renders null as an empty input/value.
  address: string | null;
  city: string | null;
  tehsil: string | null;
  // ISO timestamp of when the user registered (users.created_at).
  // The client profile page renders this as "Member since <date>".
  createdAt: string;
  // Public URL to the user's uploaded profile picture, with a
  // ?v=<timestamp> cache-buster appended on every update so the
  // browser fetches the new image instead of the cached one. Null
  // when no picture has been uploaded — the UI then falls back to
  // a first-letter initials circle.
  avatarUrl: string | null;
  emailVerified: boolean;
  accountStatus: string;
  // 'local' for password-registered users, 'google' for Google
  // OAuth users. The Change Password UI is hidden for 'google'
  // because those accounts have no local password_hash — the
  // backend rejects the change-password request anyway, but we
  // also don't want to show a button that can't work.
  authProvider: "local" | "google" | null;
  mustChangePassword: boolean;
  lawyerVerificationStatus: string | null;
  // Lawyer-profile fields, surfaced via the same /auth/me JOIN
  // the client fields use. All null for non-lawyer roles (the
  // user has no lawyer_profiles row). The lawyer view page
  // renders them read-only; the edit page exposes specialization
  // / districtBar / experienceYears / consultationFee as editable
  // but barLicenseNumber as a disabled input (UNIQUE constraint
  // + verification was tied to it).
  specialization: string | null;
  districtBar: string | null;
  barLicenseNumber: string | null;
  experienceYears: number | null;
  consultationFee: number | null;
  // Free-text "About" the lawyer writes after registration to
  // introduce themselves on the public directory. Null when the
  // lawyer hasn't filled it in yet.
  bio: string | null;

  // Registrar-profile fields, sourced from registrar_profiles via the
  // same /auth/me JOIN. Null for non-registrar roles. The registrar's
  // own profile page renders these read-only — only an admin can
  // change them via the admin Edit Registrar flow.
  assignedCourt: string | null;
  assignedTehsil: string | null;

  // True after the user has opened any dashboard at least once. The first
  // /me call after registration / admin-creation flips this from false to
  // true atomically on the server, so the dashboard header can show
  // "Welcome, X" exactly once per user and "Welcome back, X" on every
  // subsequent visit.
  firstLoginCompleted: boolean;
};

// Fetches the current authenticated user via GET /api/auth/me. The endpoint
// also performs a one-shot side-effect (marking first_login_at), so the
// returned `firstLoginCompleted` flag is durable across reloads, devices,
// and incognito sessions.
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

// Render-ready full name with sensible fallbacks: "First Last" if both are
// present; otherwise whichever is non-empty; otherwise the email handle as
// a last-resort display.
export function displayFullName(user: CurrentUser | undefined | null): string {
  if (!user) return "";
  const first = user.firstName?.trim() ?? "";
  const last = user.lastName?.trim() ?? "";
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  // Final fallback — the email handle, title-cased.
  const handle = user.email.split("@")[0] ?? "";
  return handle
    .replace(/[._-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
