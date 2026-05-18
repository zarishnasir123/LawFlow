import { useState } from "react";

import { useLogout } from "../../auth/hooks/useLogout";

export function useLogoutHandler() {
  const performLogout = useLogout();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const handleLogout = () => {
    setLogoutModalOpen(false);
    performLogout();
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
