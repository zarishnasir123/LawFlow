import { redirect } from "@tanstack/react-router";

import type { LoginRole } from "../modules/auth/types";
import { getStoredAuthUser } from "../modules/auth/utils/authStorage";

// Admin is intentionally excluded — admins log in on the dedicated admin
// panel (separate Vite app), not on this main app. If a stored user somehow
// has role "admin" here, the lookup falls back to "/login".
const roleHomePath: Partial<Record<LoginRole, string>> = {
  client: "/client-dashboard",
  lawyer: "/Lawyer-dashboard",
  registrar: "/registrar-dashboard",
};

// Frontend RBAC is defence-in-depth. The real authorisation boundary is the
// backend's authenticate + authorizeRoles middleware — an attacker who edits
// localStorage to fake a role still hits 401/403 on every protected API.
// What this guard buys us: no UI flash of admin/lawyer/registrar pages for
// the wrong user, and a clean redirect instead of a broken-looking dashboard.
export function requireAuth(allowedRoles?: LoginRole[]) {
  return () => {
    const user = getStoredAuthUser();

    if (!user) {
      throw redirect({ to: "/login" });
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      const fallback = roleHomePath[user.role] ?? "/login";
      throw redirect({ to: fallback });
    }
  };
}

// Reverse guard for the public auth pages (/login, /register, /forgot-password).
// If a client already has a stored session, send them straight to their
// dashboard — keeps the UX in line with every modern SSO app where a logged-in
// user can't accidentally land back on the login screen.
//
// localStorage is the cheap check; if the underlying refresh cookie is stale
// (revoked or expired), the dashboard's first API call 401s and the axios
// interceptor bounces them back here anyway. Worst case is a brief flicker.
export function redirectIfAuthenticated() {
  return () => {
    const user = getStoredAuthUser();

    if (!user) {
      return;
    }

    const destination = roleHomePath[user.role];
    if (destination) {
      throw redirect({ to: destination });
    }
  };
}
