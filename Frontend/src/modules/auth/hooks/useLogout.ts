import { useNavigate } from "@tanstack/react-router";

import { apiClient } from "../../../shared/api/axios";
import { chatSocket } from "../../../shared/api/chatSocket";
import { clearStoredAuth } from "../utils/authStorage";

// Proper logout: revoke the refresh-token session row server-side AND wipe
// the client-side user record + in-memory access token. Skipping the server
// call would leave the httpOnly refresh cookie live, letting anyone on this
// machine resume the session by visiting the app. Skipping the client wipe
// would leave the stored user in place, and the redirectIfAuthenticated guard
// would bounce the visitor straight back to their dashboard.
export function useLogout() {
  const navigate = useNavigate();

  return async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Refresh cookie may already be expired/invalid, or the network may be
      // down. Either way we still want to clear client state — staying on the
      // dashboard with no real session is worse than a logout that didn't
      // round-trip cleanly.
    }
    clearStoredAuth();
    // Close the live socket so it isn't left authed as this user for whoever
    // logs in next on the same tab (no full reload happens here).
    chatSocket.disconnect();
    navigate({ to: "/login" });
  };
}
