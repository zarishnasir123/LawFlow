import { useNavigate } from "@tanstack/react-router";

export function useProfileHandler() {
  const navigate = useNavigate();

  const handleProfileClick = () => {
    navigate({ to: "/lawyer-profile" });
  };

  return {
    handleProfileClick,
  };
}
