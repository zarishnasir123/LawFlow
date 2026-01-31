import type { ReactNode } from "react";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import LogoutConfirmationModal from "./modals/LogoutConfirmationModal";
import NotificationModal from "./modals/NotificationModal";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import { useNavbarActions } from "../hooks/useNavbarActions";
import { useNotificationModal } from "../hooks/useNotificationModal";

type LawyerLayoutProps = {
  brandTitle?: React.ReactNode;
  brandSubtitle?: string;
  pageSubtitle?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  children: ReactNode;
};

export default function LawyerLayout({
  brandTitle = "LawFlow",
  brandSubtitle = "Lawyer Portal",
  pageSubtitle,
  showBackButton = false,
  onBackClick,
  children,
}: LawyerLayoutProps) {
  const { logoutModalOpen, handleLogout, openLogoutModal, closeLogoutModal } = useLogoutHandler();
  const { isOpen: notificationModalOpen, openModal: openNotificationModal, closeModal: closeNotificationModal } = useNotificationModal();
  const navbarActions = useNavbarActions(openLogoutModal, openNotificationModal);

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
        showBackButton={showBackButton}
        onBackClick={onBackClick}
      >
        {children}
      </DashboardLayout>
    </>
  );
}

