import { Bell, LogOut, User } from "lucide-react";
import type { HeaderAction } from "../../../shared/types/dashboard";
import { useProfileHandler } from "./useProfileHandler";

export function useNavbarActions(onLogout: () => void, onNotificationClick: () => void): HeaderAction[] {
  const { handleProfileClick } = useProfileHandler();

  return [
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
