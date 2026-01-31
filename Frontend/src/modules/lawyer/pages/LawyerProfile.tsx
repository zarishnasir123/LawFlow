import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ProfileCard from "../../../shared/components/profile/ProfileCard";
import ProfileField from "../../../shared/components/profile/ProfileField";
import LawyerLayout from "../components/LawyerLayout";
import {
  ChangePasswordModal,
  NotificationPreferencesModal,
  DeactivateAccountModal,
} from "../components/modals";
import { useLawyerProfileStore } from "../store/lawyerProfile.store";

export default function LawyerProfile() {
  const navigate = useNavigate();
  const { profile, initializeProfile } = useLawyerProfileStore();
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  useEffect(() => {
    initializeProfile();
  }, [initializeProfile]);

  // Disable background scroll when modal is open
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
    <LawyerLayout
      brandTitle="LawFlow"
      brandSubtitle="My Profile"
    >
      <div className="px-6 py-8">
      <ProfileCard
        name={profile.fullName}
        memberSince="March 10, 2023"
        roleLabel="Lawyer"
        onEdit={() => navigate({ to: "/lawyer-profile/edit" })}
      >
        {/* Lawyer Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProfileField label="Full Name" value={profile.fullName} />
          <ProfileField label="Email Address" value={profile.email} />
          <ProfileField label="Phone Number" value={profile.phone} />
          <ProfileField label="CNIC Number" value={profile.cnic} />
          <ProfileField label="Bar Council Number" value={profile.barCouncilNumber} />
          <ProfileField label="Specialization" value={profile.specialization} />
          <ProfileField label="Years of Experience" value={profile.yearsOfExperience} />
          <ProfileField label="Office Location" value={profile.officeLocation} />
        </div>

        <ProfileField label="Address" value={profile.address} />
        
        {profile.bio && (
          <div>
            <label className="text-sm font-medium text-gray-700">Bio</label>
            <p className="mt-1 text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
              {profile.bio}
            </p>
          </div>
        )}

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

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />

      {/* Notification Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />

      {/* Deactivate Account Modal */}
      <DeactivateAccountModal
        isOpen={showDeactivateModal}
        onClose={() => setShowDeactivateModal(false)}
        onConfirm={() => {
          setShowDeactivateModal(false);
          navigate({ to: "/login" });
        }}
      />
    </LawyerLayout>
  );
}

