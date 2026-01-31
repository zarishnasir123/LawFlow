import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import ProfileCard from "../../../shared/components/profile/ProfileCard";
import LawyerLayout from "../components/LawyerLayout";
import { useLawyerProfileStore, type LawyerProfile } from "../store/lawyerProfile.store";

export default function LawyerProfileEdit() {
  const navigate = useNavigate();
  const { profile, initializeProfile, updateField, updateProfile } =
    useLawyerProfileStore();

  useEffect(() => {
    initializeProfile();
  }, [initializeProfile]);

  const handleChange = (field: keyof LawyerProfile, value: string) => {
    updateField(field, value);
  };

  const handleSave = () => {
    updateProfile(profile);
    navigate({ to: "/lawyer-profile" });
  };

  return (
    <LawyerLayout
      brandTitle="LawFlow"
      brandSubtitle="Edit Profile"
    >
      <div className="px-6 py-8">
      <ProfileCard
        name={profile.fullName}
        memberSince="March 10, 2023"
        roleLabel="Lawyer"
      >
        {/* Personal Information Section */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            Personal Information
          </h3>
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
        </div>

        {/* Professional Information Section */}
        <div className="mb-6 pb-6 border-b">
          <h3 className="font-semibold text-gray-900 mb-4">
            Professional Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableField
              label="Bar Council Number"
              value={profile.barCouncilNumber}
              onChange={(v) => handleChange("barCouncilNumber", v)}
            />
            <EditableField
              label="Specialization"
              value={profile.specialization}
              onChange={(v) => handleChange("specialization", v)}
            />
            <EditableField
              label="Years of Experience"
              value={profile.yearsOfExperience}
              onChange={(v) => handleChange("yearsOfExperience", v)}
              type="number"
            />
            <EditableField
              label="Office Location"
              value={profile.officeLocation}
              onChange={(v) => handleChange("officeLocation", v)}
            />
          </div>
        </div>

        {/* Address Section */}
        <div className="mb-6 pb-6 border-b">
          <h3 className="font-semibold text-gray-900 mb-4">Address</h3>
          <EditableField
            label="Full Address"
            value={profile.address}
            onChange={(v) => handleChange("address", v)}
            isTextarea={true}
          />
        </div>

        {/* Bio Section */}
        <div className="mb-6 pb-6 border-b">
          <h3 className="font-semibold text-gray-900 mb-4">Professional Bio</h3>
          <EditableField
            label="Bio"
            value={profile.bio}
            onChange={(v) => handleChange("bio", v)}
            isTextarea={true}
            placeholder="Write a brief professional biography"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-6">
          <button
            onClick={handleSave}
            className="bg-[#01411C] hover:bg-[#024a23] text-white px-6 py-2 rounded-md text-sm font-medium transition"
          >
            Save Changes
          </button>
          <button
            onClick={() => navigate({ to: "/lawyer-profile" })}
            className="border border-gray-300 px-6 py-2 rounded-md text-sm hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>
      </ProfileCard>
      </div>
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
  isTextarea?: boolean;
  placeholder?: string;
}

function EditableField({
  label,
  value,
  onChange,
  type = "text",
  isTextarea = false,
  placeholder = "",
}: EditableFieldProps) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {isTextarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-600"
        />
      )}
    </div>
  );
}
