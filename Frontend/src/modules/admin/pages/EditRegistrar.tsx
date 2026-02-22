import { useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import RegistrarForm, { type RegistrarFormValues } from "../components/RegistrarForm";
import { useRegistrarAccountsStore } from "../store/registrars.store";
import { AdminHeader } from "../components/AdminHeader";
import LogoutConfirmationModal from "../components/modals/LogoutConfirmationModal";

export default function EditRegistrar() {
  const navigate = useNavigate();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const { id } = useParams({ from: "/admin-registrars/edit/$id" });

  const registrar = useRegistrarAccountsStore((state) => state.getRegistrarById(id));
  const updateRegistrar = useRegistrarAccountsStore((state) => state.updateRegistrar);

  const handleLogout = () => {
    localStorage.clear();
    setLogoutModalOpen(false);
    navigate({ to: "/login" });
  };

  const initialValues: Partial<RegistrarFormValues> = useMemo(
    () => ({
      name: registrar?.name ?? "",
      email: registrar?.email ?? "",
      phone: registrar?.phone ?? "",
      cnic: registrar?.cnic ?? "",
      role: registrar?.role ?? "Registrar",
    }),
    [registrar],
  );

  const handleSubmit = (values: RegistrarFormValues) => {
    try {
      updateRegistrar({
        id,
        name: values.name,
        email: values.email,
        phone: values.phone,
        cnic: values.cnic,
        role: values.role,
      });

      alert(`Registrar "${values.name}" updated successfully.`);
      navigate({ to: "/admin-registrars" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update registrar.";
      alert(message);
    }
  };

  if (!registrar) {
    return (
      <>
        <LogoutConfirmationModal
          open={logoutModalOpen}
          onCancel={() => setLogoutModalOpen(false)}
          onConfirm={handleLogout}
        />

        <div className="min-h-screen bg-gray-50">
          <AdminHeader
            title="Registrar Accounts"
            subtitle="Admin-Provisioned Registrar Credentials"
            onOpenNotifications={() => navigate({ to: "/admin-notifications" })}
            onLogout={() => setLogoutModalOpen(true)}
          />

          <div className="w-full px-6 lg:px-8 xl:px-10 py-8">
            <div className="mx-auto max-w-2xl rounded-xl border border-rose-200 bg-white p-6 text-rose-700">
              Registrar not found.
              <button
                type="button"
                onClick={() => navigate({ to: "/admin-registrars" })}
                className="ml-3 rounded-lg border border-rose-300 px-3 py-1 text-sm"
              >
                Back to Registrars
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <LogoutConfirmationModal
        open={logoutModalOpen}
        onCancel={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
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
              title="Edit Registrar"
              subtitle="Update registrar account details"
              initialValues={initialValues}
              showPasswordFields={false}
              submitText="Update Registrar"
              onCancel={() => navigate({ to: "/admin-registrars" })}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </div>
    </>
  );
}
