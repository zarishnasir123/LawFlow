import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export function useLogoutHandler() {
  const navigate = useNavigate();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const handleLogout = () => {
    setLogoutModalOpen(false);
    navigate({ to: "/login" });
  };

  const openLogoutModal = () => {
    setLogoutModalOpen(true);
  };

  const closeLogoutModal = () => {
    setLogoutModalOpen(false);
  };

  return {
    logoutModalOpen,
    handleLogout,
    openLogoutModal,
    closeLogoutModal,
  };
}
