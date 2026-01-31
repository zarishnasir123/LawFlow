import { useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, User } from "lucide-react";
import type { HeaderAction } from "../../../shared/types/dashboard";
import { useProfileHandler } from "./useProfileHandler";

export function useNavbarActions(onLogout: () => void): HeaderAction[] {
  const navigate = useNavigate();
  const { handleProfileClick } = useProfileHandler();

  return [
    {
      label: "Notifications",
      icon: Bell,
      onClick: () => navigate({ to: "/Lawyer-dashboard" }),
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
