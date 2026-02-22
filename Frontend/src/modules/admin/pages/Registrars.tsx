import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PenSquare, Send, Trash2, UserPlus, UserX, UserCheck } from "lucide-react";

import { AdminHeader } from "../components/AdminHeader";
import LogoutConfirmationModal from "../components/modals/LogoutConfirmationModal";
import StatusToast from "../components/modals/StatusToast";
import DeleteRegistrarModal from "../components/modals/DeleteRegistrarModal";
import { useRegistrarAccountsStore } from "../store/registrars.store";

export default function Registrars() {
  const navigate = useNavigate();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
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

  const registrars = useRegistrarAccountsStore((state) => state.registrars);
  const setRegistrarStatus = useRegistrarAccountsStore((state) => state.setRegistrarStatus);
  const deleteRegistrar = useRegistrarAccountsStore((state) => state.deleteRegistrar);
  const sendCredentialsByEmail = useRegistrarAccountsStore(
    (state) => state.sendCredentialsByEmail,
  );

  const deleteTarget = registrars.find((reg) => reg.id === deleteTargetId);

  const handleLogout = () => {
    localStorage.clear();
    setLogoutModalOpen(false);
    navigate({ to: "/login" });
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
      <DeleteRegistrarModal
        open={Boolean(deleteTargetId)}
        registrarName={deleteTarget?.name}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (!deleteTargetId) return;
          try {
            const target = registrars.find((reg) => reg.id === deleteTargetId);
            deleteRegistrar(deleteTargetId);
            setToast({
              open: true,
              type: "success",
              title: "Registrar deleted",
              message: `${target?.name ?? "Registrar"} account was deleted successfully.`,
            });
            setDeleteTargetId(null);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unable to delete registrar.";
            setToast({
              open: true,
              type: "error",
              title: "Delete failed",
              message,
            });
            setDeleteTargetId(null);
          }
        }}
      />

      <div className="min-h-screen bg-gray-50">
        <AdminHeader
          title="Registrar Accounts"
          subtitle="Admin-Provisioned Registrar Credentials"
          onOpenNotifications={() => navigate({ to: "/admin-notifications" })}
          onLogout={() => setLogoutModalOpen(true)}
        />

        <div className="w-full px-6 lg:px-8 xl:px-10 py-8 space-y-6">
          <section className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#01411C]">Manage Registrars</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Registrars cannot self-register. Admin creates accounts and shares credentials securely.
                </p>
              </div>

              <button
                onClick={() => navigate({ to: "/admin-registrars/create" })}
                className="inline-flex items-center gap-2 rounded-xl bg-[#01411C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#024a23]"
              >
                <UserPlus className="h-4 w-4" />
                Create Registrar
              </button>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wide">
              <div className="col-span-3">Name</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-1">Role</div>
              <div className="col-span-2">Credentials Email</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {registrars.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-12 gap-3 px-5 py-4 items-center border-b border-gray-100"
              >
                <div className="col-span-3">
                  <div className="font-semibold text-gray-900">{r.name}</div>
                  <div className="text-sm text-gray-500">{r.phone}</div>
                </div>

                <div className="col-span-3 text-sm text-gray-700">{r.email}</div>
                <div className="col-span-1 text-sm text-gray-700">{r.role}</div>

                <div className="col-span-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      r.credentialsEmailStatus === "sent"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.credentialsEmailStatus === "sent"
                      ? "Sent"
                      : "Not Sent"}
                  </span>
                  {r.credentialsEmailSentAt ? (
                    <div className="mt-1 text-xs text-gray-500">
                      {new Date(r.credentialsEmailSentAt).toLocaleString()}
                    </div>
                  ) : null}
                </div>

                <div className="col-span-1">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      r.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {r.status === "active" ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="col-span-2">
                  <div className="flex flex-wrap justify-end gap-2">
                  <button
                    onClick={() => navigate({ to: `/admin-registrars/edit/${r.id}` })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <PenSquare className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      sendCredentialsByEmail(r.id);
                      setToast({
                        open: true,
                        type: "success",
                        title: "Credentials email sent",
                        message: `Credentials were sent to ${r.email}.`,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </button>
                  <button
                    onClick={() =>
                      setRegistrarStatus(
                        r.id,
                        r.status === "active" ? "inactive" : "active",
                      )
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      r.status === "active"
                        ? "border border-rose-300 text-rose-700 hover:bg-rose-50"
                        : "border border-green-300 text-green-700 hover:bg-green-50"
                    }`}
                  >
                    {r.status === "active" ? (
                      <UserX className="h-3.5 w-3.5" />
                    ) : (
                      <UserCheck className="h-3.5 w-3.5" />
                    )}
                    {r.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => setDeleteTargetId(r.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                  </div>
                </div>
              </div>
            ))}

            {registrars.length === 0 ? (
              <div className="p-6 text-sm text-gray-600">No registrar accounts found.</div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
