import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell, LogOut, User } from "lucide-react";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import { LogoutConfirmationModal, NotificationModal } from "./modals";
import ClientLayoutContext from "./ClientLayoutContext";

type ClientLayoutProps = {
  brandTitle?: ReactNode;
  brandSubtitle?: string;
  pageSubtitle?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  notificationBadge?: number;
  children: ReactNode;
};

export default function ClientLayout({
  brandTitle = "LawFlow",
  brandSubtitle = "Client Dashboard",
  pageSubtitle,
  showBackButton = false,
  onBackClick,
  notificationBadge = 3,
  children,
}: ClientLayoutProps) {
  const navigate = useNavigate();
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

  const actions = useMemo(
    () => [
      {
        label: "Notifications",
        icon: Bell,
        badge: notificationBadge,
        onClick: openNotificationModal,
      },
      {
        label: "Profile",
        icon: User,
        onClick: () => navigate({ to: "/client-profile" }),
      },
      {
        label: "Logout",
        icon: LogOut,
        onClick: openLogoutModal,
      },
    ],
    [navigate, notificationBadge, openNotificationModal, openLogoutModal]
  );

  return (
    <ClientLayoutContext.Provider value={{ openNotificationModal }}>
      <LogoutConfirmationModal
        open={logoutModalOpen}
        onCancel={closeLogoutModal}
        onConfirm={() => {
          closeLogoutModal();
          navigate({ to: "/login" });
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
        showBackButton={showBackButton}
        onBackClick={onBackClick}
      >
        {children}
      </DashboardLayout>
    </ClientLayoutContext.Provider>
  );
}
