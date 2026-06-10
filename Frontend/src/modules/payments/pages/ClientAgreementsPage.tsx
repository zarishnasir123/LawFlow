import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

/** Legacy route — redirects to client payments. */
export default function ClientAgreementsPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/client-payments", replace: true });
  }, [navigate]);

  return null;
}
