import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import LawyerLayout from "../components/LawyerLayout";
import ProfileCard from "../../../shared/components/profile/ProfileCard";
import ProfileField from "../../../shared/components/profile/ProfileField";
import {
  ChangePasswordModal,
  NotificationPreferencesModal,
  DeactivateAccountModal,
} from "../components/modals";
import {
  useCurrentUser,
  displayFullName,
} from "../../auth/hooks/useCurrentUser";
import { authApi, getAuthErrorMessage } from "../../auth/api";
import { clearStoredAuth } from "../../auth/utils/authStorage";

// Format users.created_at (ISO) as "Member since <Month dd, yyyy>".
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

// Render a numeric field as a string. Returns "" when null so the
// ProfileField doesn't show "null"; renders 0 explicitly so we
// don't lie about a lawyer who set their consultation fee to free.
function num(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export default function LawyerProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentUser, isLoading } = useCurrentUser();

  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  // Account deactivation — same flow we wired for clients. On
  // success the backend revokes every session, queues the
  // confirmation email, and we wipe local auth state so the
  // redirectIfAuthenticated guard can't bounce the lawyer back
  // to the dashboard. 30-day recovery window kicks in if they
  // ever try to sign back in.
  const deactivateMutation = useMutation({
    mutationFn: authApi.deactivateMyAccount,
    onSuccess: () => {
      clearStoredAuth();
      queryClient.clear();
      setShowDeactivateModal(false);
      setDeactivateError(null);
      navigate({ to: "/login" });
    },
    onError: (err) => {
      setDeactivateError(getAuthErrorMessage(err));
    },
  });

  // Disable background scroll when any modal is open.
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

  if (isLoading || !currentUser) {
    return (
      <LawyerLayout brandTitle="LawFlow" brandSubtitle="My Profile">
        <div className="px-6 py-8">
          <div className="max-w-4xl mx-auto bg-white rounded-xl border p-6 text-sm text-gray-500">
            Loading profile…
          </div>
        </div>
      </LawyerLayout>
    );
  }

  const fullName = displayFullName(currentUser);
  const memberSince = formatMemberSince(currentUser.createdAt);
  const roleLabel = capitalize(currentUser.role);

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle="My Profile">
      <div className="px-6 py-8">
        {/* View page: avatar is read-only — picture changes happen
            on /lawyer-profile/edit, same pattern as client. */}
        <ProfileCard
          name={fullName}
          memberSince={memberSince}
          roleLabel={roleLabel}
          avatarUrl={currentUser.avatarUrl}
          onEdit={() => navigate({ to: "/lawyer-profile/edit" })}
        >
          {/* Identity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProfileField label="Full Name" value={fullName} />
            <ProfileField label="Email Address" value={currentUser.email} />
            <ProfileField label="Phone Number" value={currentUser.phone ?? ""} />
            <ProfileField label="CNIC Number" value={currentUser.cnic ?? ""} />
          </div>

          {/* Practice details — what the bar council + the client-
              matching layer cares about. Bar license number is
              displayed here but is read-only on the edit form. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProfileField label="Specialization" value={currentUser.specialization ?? ""} />
            <ProfileField label="District Bar" value={currentUser.districtBar ?? ""} />
            <ProfileField label="Bar License Number" value={currentUser.barLicenseNumber ?? ""} />
            <ProfileField label="Experience (years)" value={num(currentUser.experienceYears)} />
            <ProfileField label="Consultation Fee" value={num(currentUser.consultationFee)} />
          </div>

          {/* Account Settings */}
          <div className="pt-6 border-t">
            <h3 className="font-semibold text-gray-900 mb-3">Account Settings</h3>
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
        onClose={() => {
          if (deactivateMutation.isPending) return;
          setShowDeactivateModal(false);
          setDeactivateError(null);
        }}
        onConfirm={() => deactivateMutation.mutate()}
        isLoading={deactivateMutation.isPending}
        errorMessage={deactivateError}
      />
    </LawyerLayout>
  );
}
