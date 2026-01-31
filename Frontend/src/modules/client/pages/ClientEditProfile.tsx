import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import ClientLayout from "../components/ClientLayout";
import ProfileCard from "../../../shared/components/profile/ProfileCard";
import { useClientProfileStore } from "../store";

export default function ClientProfileEdit() {
  const navigate = useNavigate();
  const { profile, initializeProfile, updateField, updateProfile } = useClientProfileStore();

  // Initialize profile
  useEffect(() => {
    initializeProfile();
  }, [initializeProfile]);

  const handleChange = (field: string, value: string) => {
    updateField(field as keyof typeof profile, value);
  };

  const handleSave = () => {
    updateProfile(profile);
    navigate({ to: "/client-profile" });
  };

  return (
    <ClientLayout
      brandSubtitle="Edit Profile"
      showBackButton
      onBackClick={() => navigate({ to: "/client-profile" })}
    >
      <div className="px-6 py-8">
        <ProfileCard
          name={profile.fullName}
          memberSince="January 15, 2024"
          roleLabel="Client"
        >
          {/* Editable Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableField
              label="Full Name"
              value={profile.fullName}
              onChange={(v) => handleChange("fullName", v)}
            />
            <EditableField
              label="Email Address"
              value={profile.email}
              onChange={(v) => handleChange("email", v)}
            />
            <EditableField
              label="Phone Number"
              value={profile.phone}
              onChange={(v) => handleChange("phone", v)}
            />
            <EditableField
              label="CNIC Number"
              value={profile.cnic}
              onChange={(v) => handleChange("cnic", v)}
            />
          </div>

          <EditableField
            label="Address"
            value={profile.address}
            onChange={(v) => handleChange("address", v)}
          />

          {/* Buttons */}
          <div className="flex flex-wrap gap-3 pt-6 border-t">
            <button
              onClick={handleSave}
              className="bg-[#01411C] hover:bg-[#024a23] text-white px-4 py-2 rounded-md text-sm"
            >
              Save Changes
            </button>
            <button
              onClick={() => navigate({ to: "/client-profile" })}
              className="border px-4 py-2 rounded-md text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </ProfileCard>
      </div>

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
}

function EditableField({ label, value, onChange }: EditableFieldProps) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-600"
      />
    </div>
  );
}
