import { redirect } from "@tanstack/react-router";

import type { LoginRole } from "../modules/auth/types";
import { getStoredAuthUser } from "../modules/auth/utils/authStorage";

const roleHomePath: Record<LoginRole, string> = {
  client: "/client-dashboard",
  lawyer: "/Lawyer-dashboard",
  registrar: "/registrar-dashboard",
  admin: "/admin-dashboard",
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
