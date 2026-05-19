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
  emailVerified: boolean;
  accountStatus: string;
  mustChangePassword: boolean;
  lawyerVerificationStatus: string | null;

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
