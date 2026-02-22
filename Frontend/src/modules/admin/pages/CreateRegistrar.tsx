import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import RegistrarForm from "../components/RegistrarForm";
import type { RegistrarFormValues } from "../components/RegistrarForm";
import { useRegistrarAccountsStore } from "../store/registrars.store";
import { AdminHeader } from "../components/AdminHeader";
import LogoutConfirmationModal from "../components/modals/LogoutConfirmationModal";
import StatusToast from "../components/modals/StatusToast";

export default function CreateRegistrar() {
  const navigate = useNavigate();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [toast, setToast] = useState<{
    open: boolean;
    type: "success" | "error";
    title: string;
    message?: string;
  }>({
    open: false,
    type: "success",
    title: "",
  });
  const createRegistrar = useRegistrarAccountsStore((state) => state.createRegistrar);
  const sendCredentialsByEmail = useRegistrarAccountsStore(
    (state) => state.sendCredentialsByEmail,
  );

  const handleLogout = () => {
    localStorage.clear();
    setLogoutModalOpen(false);
    navigate({ to: "/login" });
  };

  const handleSubmit = (values: RegistrarFormValues) => {
    try {
      const created = createRegistrar({
        name: values.name,
        email: values.email,
        phone: values.phone,
        cnic: values.cnic,
        role: values.role,
        password: values.password ?? "",
      });
      sendCredentialsByEmail(created.id);

      setToast({
        open: true,
        type: "success",
        title: "Credentials email sent",
        message: `Registrar account for ${created.name} created and credentials sent to ${created.email}.`,
      });
      window.setTimeout(() => navigate({ to: "/admin-registrars" }), 1200);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create registrar.";
      setToast({
        open: true,
        type: "error",
        title: "Registrar creation failed",
        message,
      });
    }
  };

  return (
    <>
      <LogoutConfirmationModal
        open={logoutModalOpen}
        onCancel={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
      />
      <StatusToast
        open={toast.open}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />

      <div className="min-h-screen bg-gray-50">
        <AdminHeader
          title="Registrar Accounts"
          subtitle="Admin-Provisioned Registrar Credentials"
          onOpenNotifications={() => navigate({ to: "/admin-notifications" })}
          onLogout={() => setLogoutModalOpen(true)}
        />

        <div className="w-full px-6 lg:px-8 xl:px-10 py-8">
          <div className="mx-auto max-w-4xl">
            <RegistrarForm
              title="Create New Registrar"
              subtitle="Create registrar account and issue login credentials"
              showPasswordFields
              submitText="Create Registrar"
              onCancel={() => navigate({ to: "/admin-registrars" })}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </div>
    </>
  );
}
