import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useCurrentUser } from "./useCurrentUser";

// Bounces the user to /change-temp-password whenever the backend's /me
// response carries must_change_password = true. The flag is set the moment
// the admin creates the registrar (or rotates the password via Resend
// Credentials) and only cleared after the user submits a new password via
// the change-password endpoint.
//
// Call this near the top of every authenticated dashboard / inner page.
// Calling it from a layout would be cleaner, but the three dashboards
// (lawyer / client / registrar) don't share a common layout — they each
// wrap their own.
export function useEnforcePasswordChange() {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();

  useEffect(() => {
    if (currentUser?.mustChangePassword === true) {
      navigate({ to: "/change-temp-password", replace: true });
    }
  }, [currentUser?.mustChangePassword, navigate]);
}
