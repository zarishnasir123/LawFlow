import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Home, LogOut, User } from "lucide-react";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import HeaderProfileMenu from "../../../shared/components/dashboard/HeaderProfileMenu";
import type { HeaderAction } from "../../../shared/types/dashboard";
import { useLogout } from "../../auth/hooks/useLogout";
import { useCurrentUser, displayFullName } from "../../auth/hooks/useCurrentUser";
import LogoutConfirmationModal from "../pages/components/modals/LogoutConfirmationModal";

type RegistrarLayoutProps = {
  pageSubtitle?: string;
  notificationBadge?: number;
  children: ReactNode;
};

export default function RegistrarLayout({
  pageSubtitle = "Registrar Portal",
  notificationBadge = 0,
  children,
}: RegistrarLayoutProps) {
  const navigate = useNavigate();
  const performLogout = useLogout();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const { data: currentUser } = useCurrentUser();

  const fullName = displayFullName(currentUser);
  const fallbackInitial = (fullName.charAt(0) || "?").toUpperCase();

  // Bell stays as a standalone header action. Logout moves into the
  // profile dropdown so it sits next to "My Profile" — matches the
  // lawyer/client header pattern.
  const actions: HeaderAction[] = [
    {
      label: "Dashboard",
      icon: Home,
      onClick: () => navigate({ to: "/registrar-dashboard" }),
    },
    {
      label: "Notifications",
      icon: Bell,
      badge: notificationBadge > 0 ? notificationBadge : undefined,
      onClick: () => navigate({ to: "/view-cases" }),
    },
  ];

  const profileMenu = (
    <HeaderProfileMenu
      avatarUrl={currentUser?.avatarUrl ?? null}
      fallbackInitial={fallbackInitial}
      displayName={fullName || undefined}
      email={currentUser?.email}
      items={[
        {
          label: "My Profile",
          icon: User,
          onClick: () => navigate({ to: "/registrar-profile" }),
        },
        {
          label: "Logout",
          icon: LogOut,
          onClick: () => setLogoutModalOpen(true),
          danger: true,
        },
      ]}
    />
  );

  return (
    <>
      <LogoutConfirmationModal
        open={logoutModalOpen}
        onCancel={() => setLogoutModalOpen(false)}
        onConfirm={() => {
          setLogoutModalOpen(false);
          performLogout();
        }}
      />
      <DashboardLayout
        brandTitle="LawFlow"
        brandSubtitle="Registrar Portal"
        pageSubtitle={pageSubtitle}
        actions={actions}
        profileMenu={profileMenu}
      >
        {children}
      </DashboardLayout>
    </>
  );
}
