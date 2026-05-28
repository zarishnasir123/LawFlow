import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

import RegistrarLayout from "../components/RegistrarLayout";
import ProfileCard from "../../../shared/components/profile/ProfileCard";
import AvatarCropperModal from "../../../shared/components/profile/AvatarCropperModal";
import {
  useCurrentUser,
  type CurrentUser,
} from "../../auth/hooks/useCurrentUser";
import { useEnforcePasswordChange } from "../../auth/hooks/useEnforcePasswordChange";
import {
  authApi,
  getAuthErrorMessage,
  type UpdateMyProfilePayload,
} from "../../auth/api";

function formatMemberSince(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function capitalize(value: string | null | undefined): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

// Build a minimal PATCH payload: only fields the user actually
// changed are forwarded. CNIC, court, and tehsil are not in the form
// at all (admin-managed and locked in the UI), and the backend would
// reject CNIC on PATCH anyway.
function buildPatch(initial: CurrentUser, form: FormState): UpdateMyProfilePayload {
  const patch: UpdateMyProfilePayload = {};
  if (form.firstName !== (initial.firstName ?? "")) patch.firstName = form.firstName;
  if (form.lastName !== (initial.lastName ?? "")) patch.lastName = form.lastName;
  if (form.email !== initial.email) patch.email = form.email;
  if (form.phone !== (initial.phone ?? "")) patch.phone = form.phone;
  return patch;
}

export default function RegistrarProfileEdit() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useEnforcePasswordChange();
  const { data: currentUser, isLoading } = useCurrentUser();

  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Avatar editing — two-stage flow (file pick → crop modal → upload),
  // identical to the client + lawyer edit pages so registrars get the
  // same picture-cropping UX.
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!currentUser || form) return;
    setForm({
      firstName: currentUser.firstName ?? "",
      lastName: currentUser.lastName ?? "",
      email: currentUser.email,
      phone: currentUser.phone ?? "",
    });
  }, [currentUser, form]);

  const mutation = useMutation({
    mutationFn: authApi.updateMyProfile,
    onSuccess: (updated) => {
      // Hot-swap the cached user so the view page renders the new
      // values immediately; the invalidate schedules a background
      // refetch so we stay in sync with the server.
      queryClient.setQueryData(["currentUser"], updated);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      navigate({ to: "/registrar-profile" });
    },
    onError: (err) => {
      setError(getAuthErrorMessage(err));
    },
  });

  const avatarUploadMutation = useMutation({
    mutationFn: authApi.uploadAvatar,
    onSuccess: (updated: CurrentUser) => {
      queryClient.setQueryData(["currentUser"], updated);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setAvatarError(null);
    },
    onError: (err) => {
      setAvatarError(getAuthErrorMessage(err));
    },
  });

  const avatarRemoveMutation = useMutation({
    mutationFn: authApi.removeAvatar,
    onSuccess: (updated: CurrentUser) => {
      queryClient.setQueryData(["currentUser"], updated);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setAvatarError(null);
    },
    onError: (err) => {
      setAvatarError(getAuthErrorMessage(err));
    },
  });

  const avatarBusy =
    avatarUploadMutation.isPending || avatarRemoveMutation.isPending;

  const handleAvatarClick = () => {
    if (avatarBusy) return;
    setAvatarError(null);
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear so picking the same file twice still fires onChange.
    if (e.target) e.target.value = "";
    if (!file) return;
    setPendingCropFile(file);
  };

  const handleCropConfirmed = (blob: Blob) => {
    const cropped = new File([blob], "avatar.png", {
      type: blob.type || "image/png",
    });
    setPendingCropFile(null);
    avatarUploadMutation.mutate(cropped);
  };

  const handleAvatarRemove = () => {
    if (avatarBusy) return;
    avatarRemoveMutation.mutate();
  };

  if (isLoading || !currentUser || !form) {
    return (
      <RegistrarLayout pageSubtitle="Edit Profile">
        <div className="px-6 py-8">
          <div className="max-w-4xl mx-auto bg-white rounded-xl border p-6 text-sm text-gray-500">
            Loading profile…
          </div>
        </div>
      </RegistrarLayout>
    );
  }

  const fullName = [form.firstName, form.lastName].filter(Boolean).join(" ").trim();
  const memberSince = formatMemberSince(currentUser.createdAt);
  const roleLabel = capitalize(currentUser.role);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    if (error) setError(null);
  };

  const handleSave = () => {
    if (!form) return;
    setError(null);
    const patch = buildPatch(currentUser, form);
    if (Object.keys(patch).length === 0) {
      navigate({ to: "/registrar-profile" });
      return;
    }
    mutation.mutate(patch);
  };

  return (
    <RegistrarLayout pageSubtitle="Edit Profile">
      <div className="px-6 py-8">
        <ProfileCard
          name={fullName || currentUser.email}
          memberSince={memberSince}
          roleLabel={roleLabel}
          avatarUrl={currentUser.avatarUrl}
          onAvatarClick={handleAvatarClick}
          avatarUploading={avatarBusy}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg"
            className="hidden"
            onChange={handleAvatarFileChange}
          />

          {currentUser.avatarUrl && (
            <div className="flex items-center gap-3 -mt-2">
              <button
                type="button"
                onClick={handleAvatarRemove}
                disabled={avatarBusy}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 size={14} />
                {avatarRemoveMutation.isPending ? "Removing…" : "Remove photo"}
              </button>
              <span className="text-xs text-gray-400">
                Click the avatar to upload a new one.
              </span>
            </div>
          )}

          {avatarError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {avatarError}
            </div>
          )}

          {/* Identity — editable */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableField
              label="First Name"
              value={form.firstName}
              onChange={(v) => handleChange("firstName", v)}
            />
            <EditableField
              label="Last Name"
              value={form.lastName}
              onChange={(v) => handleChange("lastName", v)}
            />
            <EditableField
              label="Email Address"
              value={form.email}
              type="email"
              onChange={(v) => handleChange("email", v)}
            />
            <EditableField
              label="Phone Number"
              value={form.phone}
              onChange={(v) => handleChange("phone", v)}
            />
          </div>

          {/* Locked fields — admin-managed identity / assignment. CNIC
              is immutable (defense-in-depth at the backend validator);
              court + tehsil are set by the admin via the Edit Registrar
              flow. The PATCH endpoint does not touch any of them. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LockedField
              label="CNIC Number"
              value={currentUser.cnic ?? ""}
              hint="CNIC is set at account creation and cannot be changed here."
            />
            <LockedField
              label="Assigned Court"
              value={currentUser.assignedCourt ?? "Not assigned"}
              hint="Court is assigned by the system administrator."
            />
            <LockedField
              label="Assigned Tehsil"
              value={currentUser.assignedTehsil ?? "Not assigned"}
              hint="Tehsil is assigned by the system administrator."
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-6 border-t">
            <button
              onClick={handleSave}
              disabled={mutation.isPending}
              className="bg-[#01411C] hover:bg-[#024a23] disabled:bg-gray-400 text-white px-6 py-2 rounded-md text-sm font-medium transition"
            >
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
            <button
              onClick={() => navigate({ to: "/registrar-profile" })}
              disabled={mutation.isPending}
              className="border border-gray-300 px-6 py-2 rounded-md text-sm hover:bg-gray-50 disabled:opacity-60 transition"
            >
              Cancel
            </button>
          </div>
        </ProfileCard>
      </div>

      <AvatarCropperModal
        file={pendingCropFile}
        onClose={() => setPendingCropFile(null)}
        onConfirm={handleCropConfirmed}
      />
    </RegistrarLayout>
  );
}

interface EditableFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}

function EditableField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: EditableFieldProps) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-600"
      />
    </div>
  );
}

interface LockedFieldProps {
  label: string;
  value: string;
  hint?: string;
}
function LockedField({ label, value, hint }: LockedFieldProps) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type="text"
        value={value}
        disabled
        className="mt-1 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
      />
      {hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
    </div>
  );
}
