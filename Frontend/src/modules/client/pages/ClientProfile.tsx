import { useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";

import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import ProfileCard from "../../../shared/components/profile/ProfileCard";
import ProfileField from "../../../shared/components/profile/ProfileField";
import {
  ChangePasswordModal,
  NotificationPreferencesModal,
  DeactivateAccountModal,
} from "../components/modals";
import { useClientProfileStore } from "../store";

export default function ClientProfile() {
  const navigate = useNavigate();
  const { profile, initializeProfile } = useClientProfileStore();

  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  // Initialize profile
  useEffect(() => {
    initializeProfile();
  }, [initializeProfile]);

  // Disable scroll when modal is open
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

  return (
    <DashboardLayout
      brandTitle="LawFlow"
      brandSubtitle="Client Profile"
      actions={[
        {
          label: "Notifications",
          icon: Bell,
          onClick: () => setShowNotificationModal(true),
          badge: 2, // You can adjust badge count
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
          onEdit={() => navigate({ to: "/client-profile-edit" })}
        >
          {/* Profile Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProfileField label="Full Name" value={profile.fullName} />
            <ProfileField label="Email Address" value={profile.email} />
            <ProfileField label="Phone Number" value={profile.phone} />
            <ProfileField label="CNIC Number" value={profile.cnic} />
          </div>

          <ProfileField label="Address" value={profile.address} />

          {/* Account Settings */}
          <div className="pt-6 border-t">
            <h3 className="font-semibold text-gray-900 mb-3">
              Account Settings
            </h3>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowChangePasswordModal(true)}
                className="border px-4 py-2 rounded-md text-sm hover:bg-gray-50 transition"
              >
                Change Password
              </button>

              <button
                onClick={() => setShowNotificationModal(true)}
                className="border px-4 py-2 rounded-md text-sm hover:bg-gray-50 transition"
              >
                Notification Preferences
              </button>

              <button
                onClick={() => setShowDeactivateModal(true)}
                className="border border-red-500 text-red-600 px-4 py-2 rounded-md text-sm hover:bg-red-50 transition"
              >
                Deactivate Account
              </button>
            </div>
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
