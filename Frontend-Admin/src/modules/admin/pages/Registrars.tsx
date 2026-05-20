import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PenSquare, Send, Trash2, UserPlus, UserX, UserCheck } from "lucide-react";

import StatusToast from "../components/modals/StatusToast";
import DeleteRegistrarModal from "../components/modals/DeleteRegistrarModal";
import ResendCredentialsConfirmationModal from "../components/modals/ResendCredentialsConfirmationModal";
import {
  deleteRegistrar,
  fetchRegistrars,
  resendRegistrarCredentials,
  setRegistrarStatus,
  type Registrar,
} from "../api/registrars";
import { extractApiErrorMessage } from "../../../shared/api/extractApiErrorMessage";

export default function Registrars() {
  const navigate = useNavigate();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  // The Send action rotates the registrar's temp password and invalidates
  // the one that was sent at account creation. Stage the target here so a
  // confirmation dialog can interpose before the destructive rotation runs.
  const [resendTargetId, setResendTargetId] = useState<string | null>(null);
  const [registrars, setRegistrars] = useState<Registrar[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
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

  // Fetch loop driven by reloadToken. The retry button just bumps the token
  // instead of calling a callback that mutates state directly — keeps the
  // effect the single owner of fetch lifecycle and avoids the
  // set-state-in-effect lint warning.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetchRegistrars({ limit: 100, offset: 0 });
        if (cancelled) return;
        setRegistrars(response.items);
      } catch (error) {
        if (!cancelled) {
          setLoadError(extractApiErrorMessage(error, "Unable to load registrars."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const deleteTarget = registrars.find((reg) => reg.registrarProfileId === deleteTargetId);

  const handleToggleStatus = async (registrar: Registrar) => {
    const nextStatus = registrar.accountStatus === "active" ? "inactive" : "active";
    setBusyId(registrar.registrarProfileId);
    try {
      const updated = await setRegistrarStatus(registrar.registrarProfileId, nextStatus);
      setRegistrars((prev) =>
        prev.map((reg) =>
          reg.registrarProfileId === updated.registrarProfileId ? updated : reg,
        ),
      );
      setToast({
        open: true,
        type: "success",
        title: nextStatus === "active" ? "Registrar activated" : "Registrar deactivated",
        message: `${updated.firstName} ${updated.lastName} is now ${nextStatus}.`,
      });
    } catch (error) {
      setToast({
        open: true,
        type: "error",
        title: "Status change failed",
        message: extractApiErrorMessage(error, "Unable to update status."),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleResendCredentials = async (registrar: Registrar) => {
    setBusyId(registrar.registrarProfileId);
    try {
      const { registrar: updated, emailDelivery } = await resendRegistrarCredentials(
        registrar.registrarProfileId,
      );
      setRegistrars((prev) =>
        prev.map((reg) =>
          reg.registrarProfileId === updated.registrarProfileId ? updated : reg,
        ),
      );
      // The password is rotated on the server even when SMTP fails. Tell
      // the admin the truth so they don't think nothing changed and try
      // again, locking out the registrar further.
      if (emailDelivery.emailSent) {
        setToast({
          open: true,
          type: "success",
          title: "Credentials email sent",
          message: `A new temporary password was sent to ${updated.email}. The previous password no longer works.`,
        });
      } else {
        setToast({
          open: true,
          type: "error",
          title: "Password rotated — email NOT delivered",
          message: `The registrar's temporary password was rotated, but the email could not be delivered (${emailDelivery.deliveryReason ?? "SMTP unavailable"}). The old password is invalidated regardless. Configure SMTP and try again.`,
        });
      }
    } catch (error) {
      setToast({
        open: true,
        type: "error",
        title: "Send failed",
        message: extractApiErrorMessage(error, "Unable to send credentials email."),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    const target = registrars.find((reg) => reg.registrarProfileId === deleteTargetId);
    setBusyId(deleteTargetId);
    try {
      await deleteRegistrar(deleteTargetId);
      setRegistrars((prev) =>
        prev.filter((reg) => reg.registrarProfileId !== deleteTargetId),
      );
      setToast({
        open: true,
        type: "success",
        title: "Registrar deleted",
        message: `${target ? `${target.firstName} ${target.lastName}` : "Registrar"} account was deleted successfully.`,
      });
    } catch (error) {
      setToast({
        open: true,
        type: "error",
        title: "Delete failed",
        message: extractApiErrorMessage(error, "Unable to delete registrar."),
      });
    } finally {
      setDeleteTargetId(null);
      setBusyId(null);
    }
  };

  return (
    <>
      <StatusToast
        open={toast.open}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
      <DeleteRegistrarModal
        open={Boolean(deleteTargetId)}
        registrarName={
          deleteTarget ? `${deleteTarget.firstName} ${deleteTarget.lastName}` : undefined
        }
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={handleConfirmDelete}
      />

      {(() => {
        const resendTarget = registrars.find(
          (reg) => reg.registrarProfileId === resendTargetId,
        );
        return (
          <ResendCredentialsConfirmationModal
            open={Boolean(resendTargetId)}
            registrarName={
              resendTarget
                ? `${resendTarget.firstName} ${resendTarget.lastName}`
                : undefined
            }
            registrarEmail={resendTarget?.email}
            onCancel={() => setResendTargetId(null)}
            onConfirm={() => {
              if (!resendTarget) return;
              const target = resendTarget;
              setResendTargetId(null);
              handleResendCredentials(target);
            }}
          />
        );
      })()}

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
                onClick={() => navigate({ to: "/registrars/create" })}
                className="inline-flex items-center gap-2 rounded-xl bg-[#01411C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#024a23]"
              >
                <UserPlus className="h-4 w-4" />
                Create Registrar
              </button>
            </div>
          </section>

          {loadError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {loadError}
              <button
                type="button"
                onClick={() => setReloadToken((t) => t + 1)}
                className="ml-3 rounded-lg border border-rose-300 px-3 py-1 text-xs"
              >
                Retry
              </button>
            </div>
          ) : null}

          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wide">
              <div className="col-span-3">Name</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-1">Role</div>
              <div className="col-span-2">Credentials Email</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {registrars.map((r) => {
              const isBusy = busyId === r.registrarProfileId;
              return (
                <div
                  key={r.registrarProfileId}
                  className="grid grid-cols-12 gap-3 px-5 py-4 items-center border-b border-gray-100"
                >
                  <div className="col-span-3">
                    <div className="font-semibold text-gray-900">
                      {r.firstName} {r.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{r.phone}</div>
                  </div>

                  <div className="col-span-3 text-sm text-gray-700">{r.email}</div>
                  <div className="col-span-1 text-sm text-gray-700">Registrar</div>

                  <div className="col-span-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        r.credentialsEmailSentAt
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {r.credentialsEmailSentAt ? "Sent" : "Not Sent"}
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
                        r.accountStatus === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {r.accountStatus === "active" ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        onClick={() =>
                          navigate({
                            to: `/registrars/edit/${r.registrarProfileId}`,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        disabled={isBusy}
                      >
                        <PenSquare className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => setResendTargetId(r.registrarProfileId)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        disabled={isBusy || r.accountStatus !== "active"}
                        title={
                          r.accountStatus !== "active"
                            ? "Activate the registrar before sending credentials"
                            : "Send a fresh temporary password"
                        }
                      >
                        <Send className="h-3.5 w-3.5" />
                        Send
                      </button>
                      <button
                        onClick={() => handleToggleStatus(r)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                          r.accountStatus === "active"
                            ? "border border-rose-300 text-rose-700 hover:bg-rose-50"
                            : "border border-green-300 text-green-700 hover:bg-green-50"
                        }`}
                        disabled={isBusy}
                      >
                        {r.accountStatus === "active" ? (
                          <UserX className="h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                        {r.accountStatus === "active" ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => setDeleteTargetId(r.registrarProfileId)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        disabled={isBusy}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {loading ? (
              <div className="p-6 text-sm text-gray-600">Loading registrars...</div>
            ) : !loadError && registrars.length === 0 ? (
              <div className="p-6 text-sm text-gray-600">No registrar accounts found.</div>
            ) : null}
          </section>
      </div>
    </>
  );
}
