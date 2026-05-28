import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  MoreVertical,
  PenSquare,
  Send,
  Trash2,
  UserPlus,
  UserX,
  UserCheck,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
} from "lucide-react";

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

function getInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0).toUpperCase();
  const last = lastName.trim().charAt(0).toUpperCase();
  return `${first}${last}` || "??";
}

export default function Registrars() {
  const navigate = useNavigate();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [resendTargetId, setResendTargetId] = useState<string | null>(null);
  const [registrars, setRegistrars] = useState<Registrar[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
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

  // Close the kebab menu on outside click and on Escape so it behaves like
  // a native dropdown without pulling in a headless-ui dependency.
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!openMenuId) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target as Node)
      ) {
        setOpenMenuId(null);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openMenuId]);

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

  const activeCount = registrars.filter((r) => r.accountStatus === "active").length;
  const inactiveCount = registrars.length - activeCount;

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
        <section className="rounded-2xl border border-green-100 bg-gradient-to-br from-white to-green-50/40 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-xl bg-[#01411C]/10 text-[#01411C]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#01411C]">Manage Registrars</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Registrars cannot self-register. Admin creates accounts and shares
                  credentials securely.
                </p>
                {registrars.length > 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-medium text-gray-700 ring-1 ring-gray-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                      {registrars.length} total
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 ring-1 ring-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {activeCount} active
                    </span>
                    {inactiveCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-600 ring-1 ring-gray-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                        {inactiveCount} inactive
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <button
              onClick={() => navigate({ to: "/registrars/create" })}
              className="inline-flex items-center gap-2 rounded-xl bg-[#01411C] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#024a23] hover:shadow"
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

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
            Loading registrars...
          </div>
        ) : !loadError && registrars.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <UserPlus className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-gray-900">
              No registrar accounts yet
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Create the first registrar to get started. They'll receive their
              credentials by email.
            </p>
            <button
              onClick={() => navigate({ to: "/registrars/create" })}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23]"
            >
              <UserPlus className="h-4 w-4" />
              Create Registrar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {registrars.map((r) => {
              const isBusy = busyId === r.registrarProfileId;
              const isActive = r.accountStatus === "active";
              const menuOpen = openMenuId === r.registrarProfileId;
              const location = [r.assignedCourt, r.assignedTehsil]
                .filter(Boolean)
                .join(" — ");

              return (
                <article
                  key={r.registrarProfileId}
                  className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-green-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3 p-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-2 ${
                          isActive
                            ? "bg-[#01411C] text-white ring-green-100"
                            : "bg-gray-300 text-white ring-gray-100"
                        }`}
                      >
                        {getInitials(r.firstName, r.lastName)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-gray-900">
                          {r.firstName} {r.lastName}
                        </h3>
                        <p className="text-xs text-gray-500">Registrar</p>
                      </div>
                    </div>

                    <div
                      className="relative"
                      ref={menuOpen ? menuContainerRef : undefined}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuId(menuOpen ? null : r.registrarProfileId)
                        }
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
                        disabled={isBusy}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        aria-label="Open actions menu"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>

                      {menuOpen ? (
                        <div
                          role="menu"
                          className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
                        >
                          <button
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuId(null);
                              navigate({
                                to: `/registrars/edit/${r.registrarProfileId}`,
                              });
                            }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <PenSquare className="h-4 w-4 text-gray-500" />
                            Edit details
                          </button>

                          <button
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuId(null);
                              setResendTargetId(r.registrarProfileId);
                            }}
                            disabled={!isActive}
                            title={
                              !isActive
                                ? "Activate the registrar before sending credentials"
                                : undefined
                            }
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
                          >
                            <Send className="h-4 w-4" />
                            Resend credentials
                          </button>

                          <button
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuId(null);
                              handleToggleStatus(r);
                            }}
                            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${
                              isActive
                                ? "text-rose-700 hover:bg-rose-50"
                                : "text-green-700 hover:bg-green-50"
                            }`}
                          >
                            {isActive ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                            {isActive ? "Deactivate account" : "Activate account"}
                          </button>

                          <div className="my-1 border-t border-gray-100" />

                          <button
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuId(null);
                              setDeleteTargetId(r.registrarProfileId);
                            }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete registrar
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2 px-5 pb-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                      <span className="truncate">{r.email}</span>
                    </div>
                    {r.phone ? (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                        <span>{r.phone}</span>
                      </div>
                    ) : null}
                    {location ? (
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                        <span className="truncate">{location}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isActive ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                      {isActive ? "Active" : "Inactive"}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        r.credentialsEmailSentAt
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                      title={
                        r.credentialsEmailSentAt
                          ? `Sent ${new Date(r.credentialsEmailSentAt).toLocaleString()}`
                          : "Credentials email has not been sent yet"
                      }
                    >
                      <Send className="h-3 w-3" />
                      {r.credentialsEmailSentAt ? "Credentials sent" : "Credentials pending"}
                    </span>

                    {r.credentialsEmailSentAt ? (
                      <span className="ml-auto text-xs text-gray-500">
                        {new Date(r.credentialsEmailSentAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
