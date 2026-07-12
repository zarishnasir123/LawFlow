import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

import ClientLayout from "../components/ClientLayout";
import ProfileCard from "../../../shared/components/profile/ProfileCard";
import AvatarCropperModal from "../../../shared/components/profile/AvatarCropperModal";
import { formatPkPhone } from "../../../shared/utils/pkFormat";
import {
  useCurrentUser,
  type CurrentUser,
} from "../../auth/hooks/useCurrentUser";
import {
  authApi,
  getAuthErrorMessage,
  type UpdateMyProfilePayload,
} from "../../auth/api";

// Format users.created_at (ISO) as "Month dd, yyyy". Defensive fallback
// keeps the header card from showing "Invalid Date" if the timestamp is
// ever missing.
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

function capitalize(role: string): string {
  if (!role) return "";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// Build the PATCH payload by including only fields that the user
// actually changed. This keeps the server's diff small and means an
// unchanged email doesn't trigger the unique-violation path on the
// backend. City + tehsil are explicit form fields — the backend's
// address-deriver only fires as a fallback when these are left
// empty, so explicit values from the user always win.
function buildPatch(
  initial: CurrentUser,
  form: FormState
): UpdateMyProfilePayload {
  const patch: UpdateMyProfilePayload = {};
  if (form.firstName !== (initial.firstName ?? "")) patch.firstName = form.firstName;
  if (form.lastName !== (initial.lastName ?? "")) patch.lastName = form.lastName;
  if (form.email !== initial.email) patch.email = form.email;
  if (form.phone !== (initial.phone ?? "")) patch.phone = form.phone;
  // CNIC is intentionally not diffed — it's locked in the UI and the
  // backend's updateMyProfileValidator rejects any cnic in the body.
  if (form.address !== (initial.address ?? "")) patch.address = form.address;
  if (form.city !== (initial.city ?? "")) patch.city = form.city;
  if (form.tehsil !== (initial.tehsil ?? "")) patch.tehsil = form.tehsil;
  return patch;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cnic: string;
  address: string;
  city: string;
  tehsil: string;
}

export default function ClientProfileEdit() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentUser, isLoading } = useCurrentUser();

  // Local form state — initialized once we have the user, then driven
  // by inputs. Keeping the form local (not in a store) means a stale
  // navigation away mid-edit doesn't pollute the next visit.
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Avatar editing state. Only mounted on this page (the view page
  // shows the avatar read-only). Two-stage flow: file pick → crop
  // modal → confirmed upload. `pendingCropFile` holds the raw file
  // between those stages so the upload doesn't fire until the user
  // hits "Apply" in the cropper.
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Seed the editable form once the current user loads. Done during render
  // (React's recommended way to derive state from freshly-arrived data) rather
  // than in an effect — the `!form` guard makes it run once and converge.
  if (currentUser && !form) {
    setForm({
      firstName: currentUser.firstName ?? "",
      lastName: currentUser.lastName ?? "",
      email: currentUser.email,
      phone: currentUser.phone ?? "",
      cnic: currentUser.cnic ?? "",
      address: currentUser.address ?? "",
      city: currentUser.city ?? "",
      tehsil: currentUser.tehsil ?? "",
    });
  }

  const mutation = useMutation({
    mutationFn: authApi.updateMyProfile,
    onSuccess: (updated) => {
      // Replace the cached user in place so the profile page renders
      // the new values immediately on navigation. The invalidate
      // schedules a background refetch so we're never out-of-sync
      // with the server.
      queryClient.setQueryData(["currentUser"], updated);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      navigate({ to: "/client-profile" });
    },
    onError: (err) => {
      setError(getAuthErrorMessage(err));
    },
  });

  // Avatar upload. Stays on this page after success (no navigation)
  // so the user sees the new picture in the header immediately
  // and can keep editing other fields without losing form state.
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

  // Avatar removal. Same cache-swap pattern as upload — the user
  // doesn't navigate away, the avatar slot just flips back to the
  // initials fallback in place.
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

  const avatarBusy = avatarUploadMutation.isPending || avatarRemoveMutation.isPending;

  const handleAvatarClick = () => {
    if (avatarBusy) return;
    setAvatarError(null);
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input value so picking the SAME file twice still
    // fires onChange (browsers suppress the event when value is
    // unchanged).
    if (e.target) e.target.value = "";
    if (!file) return;
    setPendingCropFile(file);
  };

  const handleCropConfirmed = (blob: Blob) => {
    const cropped = new File([blob], "avatar.png", { type: blob.type || "image/png" });
    setPendingCropFile(null);
    avatarUploadMutation.mutate(cropped);
  };

  const handleAvatarRemove = () => {
    if (avatarBusy) return;
    avatarRemoveMutation.mutate();
  };

  if (isLoading || !currentUser || !form) {
    return (
      <ClientLayout
        brandSubtitle="Edit Profile"
        showBackButton
        onBackClick={() => navigate({ to: "/client-profile" })}
      >
        <div className="px-6 py-8">
          <div className="max-w-4xl mx-auto bg-white rounded-xl border p-6 text-sm text-gray-500">
            Loading profile…
          </div>
        </div>
      </ClientLayout>
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
    // Empty diff → nothing to save; just navigate back so the lawyer
    // doesn't see a silent no-op spinner.
    if (Object.keys(patch).length === 0) {
      navigate({ to: "/client-profile" });
      return;
    }
    mutation.mutate(patch);
  };

  return (
    <ClientLayout
      brandSubtitle="Edit Profile"
      showBackButton
      onBackClick={() => navigate({ to: "/client-profile" })}
    >
      <div className="px-6 py-8">
        <ProfileCard
          name={fullName || currentUser.email}
          memberSince={memberSince}
          roleLabel={roleLabel}
          avatarUrl={currentUser.avatarUrl}
          onAvatarClick={handleAvatarClick}
          avatarUploading={avatarBusy}
        >
          {/* Hidden file picker — the avatar circle's onClick opens
              this; the change handler kicks off the cropper, which
              kicks off the upload mutation on Apply. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg"
            className="hidden"
            onChange={handleAvatarFileChange}
          />

          {/* Remove-photo affordance. Only shown when there's an
              avatar to remove (avoids a useless click when the user
              already has the initials fallback). Sits in its own
              row so it doesn't crowd the cropper trigger. */}
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
          {/* Editable Fields. First/Last split into two inputs maps
              cleanly to the users.first_name / users.last_name columns
              and avoids ambiguous splits on multi-word last names. */}
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
              onChange={(v) => handleChange("phone", formatPkPhone(v))}
            />
            {/* CNIC is set at registration and treated as immutable —
                changing it would silently rewrite the identity that
                audit trails and unique constraints depend on. Backend
                rejects any cnic in the PATCH body. */}
            <LockedField
              label="CNIC Number"
              value={form.cnic}
              hint="Contact support if your CNIC was set incorrectly."
            />
          </div>

          <EditableField
            label="Address"
            value={form.address}
            onChange={(v) => handleChange("address", v)}
          />

          {/* City + tehsil are free-text so the client can enter the
              actual values themselves (the backend's address-deriver
              guesses from punctuation, which fails on continuous-
              prose addresses). When left empty, the backend still
              tries to fill them in from the address as a fallback. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableField
              label="City"
              value={form.city}
              onChange={(v) => handleChange("city", v)}
            />
            <EditableField
              label="Tehsil"
              value={form.tehsil}
              onChange={(v) => handleChange("tehsil", v)}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-wrap gap-3 pt-6 border-t">
            <button
              onClick={handleSave}
              disabled={mutation.isPending}
              className="bg-[#01411C] hover:bg-[#024a23] disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm"
            >
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
            <button
              onClick={() => navigate({ to: "/client-profile" })}
              disabled={mutation.isPending}
              className="border px-4 py-2 rounded-md text-sm hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </ProfileCard>
      </div>

      {/* Crop / framing modal. Mounted at the layout root so its
          overlay covers the whole viewport. Hands back a Blob on
          Apply which we re-wrap into a File for the upload mutation. */}
      <AvatarCropperModal
        file={pendingCropFile}
        onClose={() => setPendingCropFile(null)}
        onConfirm={handleCropConfirmed}
      />
    </ClientLayout>
  );
}

/* ───────────────────────────────
   Editable Input Field Component
──────────────────────────────── */
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

// Read-only counterpart for fields that should display the current
// value but cannot be modified from this page (e.g. CNIC). Visually
// matches the disabled "Bar License Number" input the lawyer edit
// page uses so users get a consistent "this is locked" signal.
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
