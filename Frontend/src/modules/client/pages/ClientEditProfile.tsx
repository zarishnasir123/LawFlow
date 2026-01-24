import { useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import ProfileCard from "../../../shared/components/profile/ProfileCard";
import { useClientProfileStore } from "../store";
import {
  ChangePasswordModal,
  NotificationPreferencesModal,
  DeactivateAccountModal,
} from "../components/modals";

export default function ClientProfileEdit() {
  const navigate = useNavigate();
  const { profile, initializeProfile, updateField, updateProfile } = useClientProfileStore();

  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  // Initialize profile
  useEffect(() => {
    initializeProfile();
  }, [initializeProfile]);

  // Disable scroll when modals are open
  useEffect(() => {
    const isAnyModalOpen =
      showChangePasswordModal || showNotificationModal || showDeactivateModal;

    if (isAnyModalOpen) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }

    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [showChangePasswordModal, showNotificationModal, showDeactivateModal]);

  const handleChange = (field: string, value: string) => {
    updateField(field as keyof typeof profile, value);
  };

  const handleSave = () => {
    updateProfile(profile);
    navigate({ to: "/client-profile" });
  };

  return (
    <DashboardLayout
      brandTitle="LawFlow"
      brandSubtitle="Edit Profile"
      actions={[
        {
          label: "Notifications",
          icon: Bell,
          onClick: () => setShowNotificationModal(true),
          badge: 2,
        },
        {
          label: "Profile",
          icon: User,
          onClick: () => navigate({ to: "/client-profile" }),
        },
        {
          label: "Logout",
          icon: LogOut,
          onClick: () => navigate({ to: "/login" }),
        },
      ]}
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

      {/* Modals */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
      <NotificationPreferencesModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />
      <DeactivateAccountModal
        isOpen={showDeactivateModal}
        onClose={() => setShowDeactivateModal(false)}
        onConfirm={() => {
          setShowDeactivateModal(false);
          navigate({ to: "/login" });
        }}
      />
    </DashboardLayout>
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
