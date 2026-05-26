import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import HeaderProfileMenu from "../../../shared/components/dashboard/HeaderProfileMenu";
import LogoutConfirmationModal from "./modals/LogoutConfirmationModal";
import NotificationModal from "./modals/NotificationModal";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import { useNavbarActions } from "../hooks/useNavbarActions";
import { useNotificationModal } from "../hooks/useNotificationModal";
import { useCurrentUser, displayFullName } from "../../auth/hooks/useCurrentUser";

type LawyerLayoutProps = {
  brandTitle?: React.ReactNode;
  brandSubtitle?: string;
  pageSubtitle?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  backLabel?: string;
  children: ReactNode;
};

export default function LawyerLayout({
  brandTitle = "LawFlow",
  brandSubtitle = "Lawyer Portal",
  pageSubtitle,
  showBackButton = false,
  onBackClick,
  backLabel,
  children,
}: LawyerLayoutProps) {
  const navigate = useNavigate();
  const { logoutModalOpen, handleLogout, openLogoutModal, closeLogoutModal } = useLogoutHandler();
  const { isOpen: notificationModalOpen, openModal: openNotificationModal, closeModal: closeNotificationModal } = useNotificationModal();
  const navbarActions = useNavbarActions(openLogoutModal, openNotificationModal);
  const { data: currentUser } = useCurrentUser();

  const fullName = displayFullName(currentUser);
  const fallbackInitial = (fullName.charAt(0) || "?").toUpperCase();

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
          onClick: () => navigate({ to: "/lawyer-profile" }),
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

  return (
    <>
      <LogoutConfirmationModal
        open={logoutModalOpen}
        onCancel={closeLogoutModal}
        onConfirm={handleLogout}
      />
      <NotificationModal
        isOpen={notificationModalOpen}
        onClose={closeNotificationModal}
      />
      <DashboardLayout
        brandTitle={brandTitle}
        brandSubtitle={brandSubtitle}
        pageSubtitle={pageSubtitle}
        actions={navbarActions}
        profileMenu={profileMenu}
        showBackButton={showBackButton}
        onBackClick={onBackClick}
        backLabel={backLabel}
      >
        {children}
      </DashboardLayout>
    </>
  );
}

