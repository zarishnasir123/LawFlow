import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell, Home, LogOut, User } from "lucide-react";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import HeaderProfileMenu from "../../../shared/components/dashboard/HeaderProfileMenu";
import { useLogout } from "../../auth/hooks/useLogout";
import { useCurrentUser, displayFullName } from "../../auth/hooks/useCurrentUser";
import { LogoutConfirmationModal, NotificationModal } from "./modals";
import ClientLayoutContext from "./ClientLayoutContext";

type ClientLayoutProps = {
  brandTitle?: ReactNode;
  brandSubtitle?: string;
  pageSubtitle?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  backLabel?: string;
  notificationBadge?: number;
  children: ReactNode;
};

export default function ClientLayout({
  brandTitle = "LawFlow",
  brandSubtitle = "Client Dashboard",
  pageSubtitle,
  showBackButton = false,
  onBackClick,
  backLabel,
  notificationBadge = 3,
  children,
}: ClientLayoutProps) {
  const navigate = useNavigate();
  const performLogout = useLogout();
  const { data: currentUser } = useCurrentUser();
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const openNotificationModal = useCallback(() => setNotificationModalOpen(true), []);
  const closeNotificationModal = useCallback(() => setNotificationModalOpen(false), []);

  const openLogoutModal = useCallback(() => setLogoutModalOpen(true), []);
  const closeLogoutModal = useCallback(() => setLogoutModalOpen(false), []);

  useEffect(() => {
    const isModalOpen = notificationModalOpen || logoutModalOpen;
    if (isModalOpen) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }

    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [notificationModalOpen, logoutModalOpen]);

  // First letter of the client's name for the initials fallback when
  // no avatar is set — matches the green-on-white circle the
  // ProfileCard renders elsewhere.
  const fullName = displayFullName(currentUser);
  const avatarInitial = (fullName.charAt(0) || "?").toUpperCase();
  const avatarUrl = currentUser?.avatarUrl ?? null;

  // Profile + Logout live inside the avatar dropdown — Gmail-style —
  // so the header bar only carries the truly-global icons (Dashboard,
  // Notifications). Keeping the dropdown definition outside useMemo
  // because JSX expressions don't need memoising and React handles
  // re-renders cheaply for a static set of menu items.
  const profileMenu = (
    <HeaderProfileMenu
      avatarUrl={avatarUrl}
      fallbackInitial={avatarInitial}
      displayName={fullName || undefined}
      email={currentUser?.email}
      items={[
        {
          label: "My Profile",
          icon: User,
          onClick: () => navigate({ to: "/client-profile" }),
        },
        {
          label: "Logout",
          icon: LogOut,
          onClick: openLogoutModal,
          danger: true,
        },
      ]}
    />
  );

  const actions = useMemo(
    () => [
      {
        label: "Dashboard",
        icon: Home,
        onClick: () => navigate({ to: "/client-dashboard" }),
      },
      {
        label: "Notifications",
        icon: Bell,
        badge: notificationBadge,
        onClick: openNotificationModal,
      },
    ],
    [navigate, notificationBadge, openNotificationModal]
  );

  return (
    <ClientLayoutContext.Provider value={{ openNotificationModal }}>
      <LogoutConfirmationModal
        open={logoutModalOpen}
        onCancel={closeLogoutModal}
        onConfirm={() => {
          closeLogoutModal();
          performLogout();
        }}
      />
      <NotificationModal
        isOpen={notificationModalOpen}
        onClose={closeNotificationModal}
      />
      <DashboardLayout
        brandTitle={brandTitle}
        brandSubtitle={brandSubtitle}
        pageSubtitle={pageSubtitle}
        actions={actions}
        profileMenu={profileMenu}
        showBackButton={showBackButton}
        onBackClick={onBackClick}
        backLabel={backLabel}
      >
        {children}
      </DashboardLayout>
    </ClientLayoutContext.Provider>
  );
}
