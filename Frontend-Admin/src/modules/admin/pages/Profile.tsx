import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Camera,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { formatPkPhone } from "../../../shared/utils/pkFormat";

import {
  avatarInitial,
  displayFullName,
  useCurrentUser,
  type CurrentUser,
} from "../../auth/hooks/useCurrentUser";
import { authApi, getAuthErrorMessage } from "../../auth/api";
import type { UpdateMyProfilePayload } from "../../auth/types";
import AvatarCropperModal from "../../../shared/components/profile/AvatarCropperModal";
import ChangePasswordModal from "../components/modals/ChangePasswordModal";
import StatusToast from "../components/modals/StatusToast";

type ToastState = {
  open: boolean;
  type: "success" | "error";
  title: string;
  message?: string;
};

type FormState = {
  firstName: string;
  lastName: string;
  phone: string;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildInitialForm(user: CurrentUser): FormState {
  return {
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    phone: user.phone ?? "",
  };
}

// Only send the fields the admin actually changed. Empty string is a legitimate
// "clear it" for phone; first/last are required so we still forward whatever's
// typed when it differs.
function buildPatch(user: CurrentUser, form: FormState): UpdateMyProfilePayload {
  const patch: UpdateMyProfilePayload = {};
  if (form.firstName !== (user.firstName ?? "")) patch.firstName = form.firstName;
  if (form.lastName !== (user.lastName ?? "")) patch.lastName = form.lastName;
  if (form.phone !== (user.phone ?? "")) patch.phone = form.phone;
  return patch;
}

export default function Profile() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useCurrentUser();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    open: false,
    type: "success",
    title: "",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Seed the form once during render (not in an effect) so a background refetch
  // doesn't wipe in-progress edits.
  if (user && form === null) {
    setForm(buildInitialForm(user));
  }

  const showToast = (next: Omit<ToastState, "open">) =>
    setToast({ ...next, open: true });

  const cacheUpdated = (updated: CurrentUser) => {
    queryClient.setQueryData(["currentUser"], updated);
    queryClient.invalidateQueries({ queryKey: ["currentUser"] });
  };

  const profileMutation = useMutation({
    mutationFn: authApi.updateMyProfile,
    onSuccess: (updated) => {
      cacheUpdated(updated);
      setForm(buildInitialForm(updated));
      setEditing(false);
      showToast({ type: "success", title: "Profile updated" });
    },
    onError: (err) =>
      showToast({
        type: "error",
        title: "Update failed",
        message: getAuthErrorMessage(err),
      }),
  });

  const avatarUploadMutation = useMutation({
    mutationFn: authApi.uploadAvatar,
    onSuccess: (updated) => {
      cacheUpdated(updated);
      showToast({ type: "success", title: "Profile photo updated" });
    },
    onError: (err) =>
      showToast({
        type: "error",
        title: "Photo upload failed",
        message: getAuthErrorMessage(err),
      }),
  });

  const avatarRemoveMutation = useMutation({
    mutationFn: authApi.removeAvatar,
    onSuccess: (updated) => {
      cacheUpdated(updated);
      showToast({ type: "success", title: "Profile photo removed" });
    },
    onError: (err) =>
      showToast({
        type: "error",
        title: "Couldn't remove photo",
        message: getAuthErrorMessage(err),
      }),
  });

  const avatarBusy =
    avatarUploadMutation.isPending || avatarRemoveMutation.isPending;

  if (isLoading || !user || !form) {
    return (
      <div className="w-full px-6 lg:px-8 xl:px-10 py-8">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your profile…
        </div>
      </div>
    );
  }

  const fullName = displayFullName(user);

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (file) setPendingCropFile(file);
  };

  const handleCropConfirmed = (blob: Blob) => {
    const cropped = new File([blob], "avatar.png", {
      type: blob.type || "image/png",
    });
    setPendingCropFile(null);
    avatarUploadMutation.mutate(cropped);
  };

  const handleSave = () => {
    const patch = buildPatch(user, form);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      showToast({
        type: "error",
        title: "Name required",
        message: "First and last name can't be empty.",
      });
      return;
    }
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    profileMutation.mutate(patch);
  };

  const handleCancel = () => {
    setForm(buildInitialForm(user));
    setEditing(false);
  };

  const fieldBase =
    "mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none transition";
  const editableField = `${fieldBase} border-gray-200 bg-white text-gray-800 focus:border-[var(--primary)] focus:ring-2 focus:ring-green-100`;
  const lockedField = `${fieldBase} border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed`;

  return (
    <>
      <StatusToast
        open={toast.open}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />

      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      <AvatarCropperModal
        file={pendingCropFile}
        onConfirm={handleCropConfirmed}
        onClose={() => setPendingCropFile(null)}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg"
        className="hidden"
        onChange={handleAvatarPick}
      />

      <div className="w-full px-6 lg:px-8 xl:px-10 py-8 space-y-6">
        {/* Header card */}
        <section className="overflow-hidden rounded-xl border border-green-100 bg-white shadow-sm">
          <div className="h-20 bg-gradient-to-r from-[#01411C] to-[#04632b]" />
          <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
            <div className="-mt-12 flex-shrink-0">
              <button
                type="button"
                onClick={() => !avatarBusy && fileInputRef.current?.click()}
                title="Change profile photo"
                className="group relative block h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-[#01411C] shadow-md"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-3xl font-bold text-white">
                    {avatarInitial(user)}
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                  {avatarBusy ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : (
                    <Camera className="h-5 w-5 text-white" />
                  )}
                </span>
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-bold text-gray-900">
                  {fullName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-[#01411C]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Administrator
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm text-gray-600">{user.email}</p>
              <p className="mt-1 text-xs text-gray-400">
                Member since {formatDate(user.createdAt)}
              </p>
            </div>

            {user.avatarUrl && (
              <button
                type="button"
                onClick={() => !avatarBusy && avatarRemoveMutation.mutate()}
                disabled={avatarBusy}
                className="inline-flex items-center gap-1.5 self-start rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 sm:self-end"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {avatarRemoveMutation.isPending ? "Removing…" : "Remove photo"}
              </button>
            )}
          </div>
        </section>

        {/* Personal Information */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Personal Information
            </h2>
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-gray-700">
                First Name
              </label>
              <input
                type="text"
                value={form.firstName}
                disabled={!editing}
                onChange={(e) =>
                  setForm((p) => p && { ...p, firstName: e.target.value })
                }
                className={editing ? editableField : lockedField}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">
                Last Name
              </label>
              <input
                type="text"
                value={form.lastName}
                disabled={!editing}
                onChange={(e) =>
                  setForm((p) => p && { ...p, lastName: e.target.value })
                }
                className={editing ? editableField : lockedField}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">
                Phone Number
              </label>
              <input
                type="tel"
                value={form.phone}
                disabled={!editing}
                placeholder={editing ? "+92 300 0000000" : undefined}
                onChange={(e) =>
                  setForm((p) => p && { ...p, phone: formatPkPhone(e.target.value) })
                }
                className={editing ? editableField : lockedField}
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                Email Address
                <Lock className="h-3 w-3 text-gray-400" />
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className={lockedField}
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Your login email can't be changed here.
              </p>
            </div>

            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                CNIC
                <Lock className="h-3 w-3 text-gray-400" />
              </label>
              <input
                type="text"
                value={user.cnic ?? "—"}
                disabled
                className={lockedField}
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Contact support if your CNIC was set incorrectly.
              </p>
            </div>
          </div>

          {editing && (
            <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-100 pt-5">
              <button
                type="button"
                onClick={handleSave}
                disabled={profileMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#024a23] disabled:opacity-50"
              >
                {profileMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {profileMutation.isPending ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={profileMutation.isPending}
                className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </section>

        {/* Account */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Account</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Status
              </p>
              <p className="mt-1 text-sm font-semibold capitalize text-gray-800">
                {user.accountStatus}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Email Verified
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-gray-800">
                {user.emailVerified ? (
                  <>
                    <BadgeCheck className="h-4 w-4 text-emerald-600" />
                    Verified
                  </>
                ) : (
                  "Not verified"
                )}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Member Since
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-800">
                {formatDate(user.createdAt)}
              </p>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Security</h2>
          <p className="mb-4 text-sm text-gray-600">
            Keep your account secure with a strong password.
          </p>
          <div className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-green-50 text-[#01411C]">
                <KeyRound className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-800">Password</p>
                <p className="text-xs text-gray-500">
                  Change the password you use to sign in.
                </p>
              </div>
            </div>
            {user.authProvider !== "google" && (
              <button
                type="button"
                onClick={() => setShowChangePassword(true)}
                className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#024a23]"
              >
                Change Password
              </button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
