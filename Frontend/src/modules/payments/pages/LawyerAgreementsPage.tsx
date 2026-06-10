import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

/** Legacy route — redirects to case payment plans. */
export default function LawyerAgreementsPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/lawyer-case-payments", replace: true });
  }, [navigate]);

  return null;
}
