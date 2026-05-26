import { Bell, Home, LogOut, User } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { HeaderAction } from "../../../shared/types/dashboard";
import { useProfileHandler } from "./useProfileHandler";

export function useNavbarActions(onLogout: () => void, onNotificationClick: () => void): HeaderAction[] {
  const navigate = useNavigate();
  const { handleProfileClick } = useProfileHandler();

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
    {
      label: "Profile",
      icon: User,
      onClick: handleProfileClick,
    },
    {
      label: "Logout",
      icon: LogOut,
      onClick: onLogout,
    },
  ];
}
