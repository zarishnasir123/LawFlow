import type { ReactNode } from "react";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import LogoutConfirmationModal from "./modals/LogoutConfirmationModal";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import { useNavbarActions } from "../hooks/useNavbarActions";

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
  const navbarActions = useNavbarActions(openLogoutModal);

  return (
    <>
      <LogoutConfirmationModal
        open={logoutModalOpen}
        onCancel={closeLogoutModal}
        onConfirm={handleLogout}
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
