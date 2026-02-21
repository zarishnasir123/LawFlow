import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, LogOut } from "lucide-react";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import type { HeaderAction } from "../../../shared/types/dashboard";
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
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const actions: HeaderAction[] = [
    {
      label: "Notifications",
      icon: Bell,
      badge: notificationBadge > 0 ? notificationBadge : undefined,
      onClick: () => navigate({ to: "/view-cases" }),
    },
    {
      label: "Logout",
      icon: LogOut,
      onClick: () => setLogoutModalOpen(true),
    },
  ];

  return (
    <>
      <LogoutConfirmationModal
        open={logoutModalOpen}
        onCancel={() => setLogoutModalOpen(false)}
        onConfirm={() => {
          setLogoutModalOpen(false);
          localStorage.clear();
          navigate({ to: "/login" });
        }}
      />
      <DashboardLayout
        brandTitle="LawFlow"
        brandSubtitle="Registrar Portal"
        pageSubtitle={pageSubtitle}
        actions={actions}
      >
        {children}
      </DashboardLayout>
    </>
  );
}

