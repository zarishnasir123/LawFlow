import { Bell, Home } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { HeaderAction } from "../../../shared/types/dashboard";

// Note: Profile + Logout are deliberately NOT here anymore — the
// avatar dropdown in LawyerLayout owns both, Gmail-style.
export function useNavbarActions(_onLogout: () => void, onNotificationClick: () => void): HeaderAction[] {
  const navigate = useNavigate();

  return [
    {
      label: "Dashboard",
      icon: Home,
      onClick: () => navigate({ to: "/Lawyer-dashboard" }),
    },
    {
      label: "Notifications",
      icon: Bell,
      onClick: onNotificationClick,
      badge: 3,
    },
  ];
}
