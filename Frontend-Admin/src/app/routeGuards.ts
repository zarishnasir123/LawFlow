import { redirect } from "@tanstack/react-router";

import { clearStoredAuth, getStoredAuthUser } from "../modules/auth/utils/authStorage";

// Frontend RBAC is defence-in-depth. The real authorisation boundary is the
// backend's authenticate + authorizeRoles("admin") middleware — every admin
// API call returns 401/403 if the bearer token is missing, expired, or
// belongs to a non-admin user. This guard just prevents a flash of the admin
// UI for a wrong-role user and routes them back to /login cleanly.
export function requireAdmin() {
  return () => {
    const user = getStoredAuthUser();

    if (!user) {
      throw redirect({ to: "/login" });
    }

    if (user.role !== "admin") {
      clearStoredAuth();
      throw redirect({ to: "/login" });
    }
  };
}
