import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

import LawyerLayout from "../components/LawyerLayout";
import ProfileCard from "../../../shared/components/profile/ProfileCard";
import AvatarCropperModal from "../../../shared/components/profile/AvatarCropperModal";
import {
  useCurrentUser,
  type CurrentUser,
} from "../../auth/hooks/useCurrentUser";
import {
  authApi,
  getAuthErrorMessage,
  type UpdateMyProfilePayload,
} from "../../auth/api";

// Specialization is a closed set on the backend (Civil | Family —
// see registerLawyerValidator and updateMyProfileValidator). Render
// as a select so the lawyer can't type something that the server
// would reject.
const SPECIALIZATIONS = ["Civil", "Family"] as const;
type Specialization = (typeof SPECIALIZATIONS)[number];

// Format users.created_at as "Month dd, yyyy" with a defensive
// fallback so the header card never shows "Invalid Date".
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

// Local form state. Strings everywhere (including numbers) because
// HTML inputs hand us strings — we coerce back at save time.
interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cnic: string;
  specialization: string;
  districtBar: string;
  experienceYears: string;
  consultationFee: string;
}

// Build the PATCH payload by including only fields the user
// actually changed. Numeric fields are coerced to Number at the
// boundary; empty string → undefined so the backend leaves the
// existing value alone rather than writing NULL by accident. Bar
// license number is intentionally absent — the input is disabled
// in the UI and the backend would ignore it anyway.
function buildPatch(initial: CurrentUser, form: FormState): UpdateMyProfilePayload {
  const patch: UpdateMyProfilePayload = {};

  if (form.firstName !== (initial.firstName ?? "")) patch.firstName = form.firstName;
  if (form.lastName !== (initial.lastName ?? "")) patch.lastName = form.lastName;
  if (form.email !== initial.email) patch.email = form.email;
  if (form.phone !== (initial.phone ?? "")) patch.phone = form.phone;
  if (form.cnic !== (initial.cnic ?? "")) patch.cnic = form.cnic;

  const initialSpec = initial.specialization ?? "";
  if (form.specialization !== initialSpec) {
    // Only forward when it's one of the allowed values. Empty
    // string means "no change" rather than "clear it".
    if (SPECIALIZATIONS.includes(form.specialization as Specialization)) {
      patch.specialization = form.specialization as Specialization;
    }
  }

  if (form.districtBar !== (initial.districtBar ?? "")) {
    patch.districtBar = form.districtBar;
  }

  const initialExp = initial.experienceYears !== null ? String(initial.experienceYears) : "";
  if (form.experienceYears !== initialExp) {
    const n = Number(form.experienceYears);
    if (Number.isFinite(n) && n >= 0) {
      patch.experienceYears = n;
    }
  }

  const initialFee = initial.consultationFee !== null ? String(initial.consultationFee) : "";
  if (form.consultationFee !== initialFee) {
    const n = Number(form.consultationFee);
    if (Number.isFinite(n) && n >= 0) {
      patch.consultationFee = n;
    }
  }

  return patch;
}

export default function LawyerProfileEdit() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentUser, isLoading } = useCurrentUser();

  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Avatar editing state — same two-stage flow as the client edit
  // page (file pick → crop modal → upload). Both upload and remove
  // are non-navigating so the lawyer can keep editing other fields.
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize form once when currentUser arrives. The `!form` check
  // means later refetches don't blow away in-progress edits.
  useEffect(() => {
    if (!currentUser || form) return;
    setForm({
      firstName: currentUser.firstName ?? "",
      lastName: currentUser.lastName ?? "",
      email: currentUser.email,
      phone: currentUser.phone ?? "",
      cnic: currentUser.cnic ?? "",
      specialization: currentUser.specialization ?? "",
      districtBar: currentUser.districtBar ?? "",
      experienceYears:
        currentUser.experienceYears !== null
          ? String(currentUser.experienceYears)
          : "",
      consultationFee:
        currentUser.consultationFee !== null
          ? String(currentUser.consultationFee)
          : "",
    });
  }, [currentUser, form]);

  const mutation = useMutation({
    mutationFn: authApi.updateMyProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(["currentUser"], updated);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      navigate({ to: "/lawyer-profile" });
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
      <LawyerLayout brandTitle="LawFlow" brandSubtitle="Edit Profile">
        <div className="px-6 py-8">
          <div className="max-w-4xl mx-auto bg-white rounded-xl border p-6 text-sm text-gray-500">
            Loading profile…
          </div>
        </div>
      </LawyerLayout>
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
    // Empty diff → navigate back; don't spin on a no-op request.
    if (Object.keys(patch).length === 0) {
      navigate({ to: "/lawyer-profile" });
      return;
    }
    mutation.mutate(patch);
  };

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle="Edit Profile">
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
              this; the change handler kicks off the cropper. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg"
            className="hidden"
            onChange={handleAvatarFileChange}
          />

          {/* Remove photo affordance — only when an avatar is set. */}
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

          {/* Identity */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Personal Information</h3>
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
              <EditableField
                label="CNIC Number"
                value={form.cnic}
                placeholder="12345-1234567-1"
                onChange={(v) => handleChange("cnic", v)}
              />
            </div>
          </div>

          {/* Practice details */}
          <div className="pt-6 border-t">
            <h3 className="font-semibold text-gray-900 mb-3">Practice Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Specialization is a closed set — render as a select. */}
              <div>
                <label className="text-sm font-medium text-gray-700">Specialization</label>
                <select
                  value={form.specialization}
                  onChange={(e) => handleChange("specialization", e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value="">— Select specialization —</option>
                  {SPECIALIZATIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <EditableField
                label="District Bar"
                value={form.districtBar}
                onChange={(v) => handleChange("districtBar", v)}
              />

              <EditableField
                label="Experience (years)"
                value={form.experienceYears}
                type="number"
                onChange={(v) => handleChange("experienceYears", v)}
              />

              <EditableField
                label="Consultation Fee"
                value={form.consultationFee}
                type="number"
                onChange={(v) => handleChange("consultationFee", v)}
              />
            </div>

            {/* Bar License Number — read-only. Backend ignores this
                field even if forged in the request body. */}
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">
                Bar License Number
              </label>
              <input
                type="text"
                value={currentUser.barLicenseNumber ?? ""}
                disabled
                className="mt-1 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-6 border-t">
            <button
              onClick={handleSave}
              disabled={mutation.isPending}
              className="bg-[#01411C] hover:bg-[#024a23] disabled:bg-gray-400 text-white px-6 py-2 rounded-md text-sm font-medium transition"
            >
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
            <button
              onClick={() => navigate({ to: "/lawyer-profile" })}
              disabled={mutation.isPending}
              className="border border-gray-300 px-6 py-2 rounded-md text-sm hover:bg-gray-50 disabled:opacity-60 transition"
            >
              Cancel
            </button>
          </div>
        </ProfileCard>
      </div>

      {/* Crop / framing modal — same component the client edit page
          uses. Hands back a Blob on Apply which we re-wrap into a
          File for the upload mutation. */}
      <AvatarCropperModal
        file={pendingCropFile}
        onClose={() => setPendingCropFile(null)}
        onConfirm={handleCropConfirmed}
      />
    </LawyerLayout>
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
