import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import ClientLayout from "../components/ClientLayout";
import useClientLayout from "../components/useClientLayout";
import ProfileCard from "../../../shared/components/profile/ProfileCard";
import ProfileField from "../../../shared/components/profile/ProfileField";
import {
  ChangePasswordModal,
  DeactivateAccountModal,
} from "../components/modals";
import { useCurrentUser, displayFullName } from "../../auth/hooks/useCurrentUser";
import { authApi, getAuthErrorMessage } from "../../auth/api";
import { clearStoredAuth } from "../../auth/utils/authStorage";

// Format users.created_at (ISO string) as "Member since <Month dd, yyyy>".
// Defensive: falls back to the empty string if the timestamp is missing
// or unparseable so we never render "Invalid Date".
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

export default function ClientProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openNotificationModal } = useClientLayout();
  const { data: currentUser, isLoading } = useCurrentUser();

  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  // Account deactivation. On success we wipe local auth state the
  // same way useLogout does (otherwise the redirectIfAuthenticated
  // guard would bounce the user back to the dashboard) and send
  // them to /login. The backend's 30-day recovery window lets the
  // user sign back in within a month to silently reactivate.
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

  // Disable scroll when modal is open
  useEffect(() => {
    const isAnyModalOpen = showChangePasswordModal || showDeactivateModal;

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
  }, [showChangePasswordModal, showDeactivateModal]);

  if (isLoading || !currentUser) {
    return (
      <ClientLayout brandSubtitle="Client Profile">
        <div className="px-6 py-8">
          <div className="max-w-4xl mx-auto bg-white rounded-xl border p-6 text-sm text-gray-500">
            Loading profile…
          </div>
        </div>
      </ClientLayout>
    );
  }

  const fullName = displayFullName(currentUser);
  const memberSince = formatMemberSince(currentUser.createdAt);
  const roleLabel = capitalize(currentUser.role);

  return (
    <ClientLayout brandSubtitle="Client Profile">
      <div className="px-6 py-8">
        {/* View page: avatar is read-only. Picture changes are only
            allowed from /client-profile-edit so the user explicitly
            opts into edit mode (matches the Instagram pattern the
            user requested). No onAvatarClick handler here → the
            ProfileCard renders the avatar as a non-interactive
            circle, no hover overlay, no file picker. */}
        <ProfileCard
          name={fullName}
          memberSince={memberSince}
          roleLabel={roleLabel}
          avatarUrl={currentUser.avatarUrl}
          onEdit={() => navigate({ to: "/client-profile-edit" })}
        >
          {/* Profile Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProfileField label="Full Name" value={fullName} />
            <ProfileField label="Email Address" value={currentUser.email} />
            <ProfileField label="Phone Number" value={currentUser.phone ?? ""} />
            <ProfileField label="CNIC Number" value={currentUser.cnic ?? ""} />
          </div>

          <ProfileField label="Address" value={currentUser.address ?? ""} />

          {/* City + tehsil are explicit form fields on the edit page
              (the backend's address-deriver is a fallback only).
              Render them here so the client can see the current
              values without going into edit mode. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProfileField label="City" value={currentUser.city ?? ""} />
            <ProfileField label="Tehsil" value={currentUser.tehsil ?? ""} />
          </div>

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
                onClick={openNotificationModal}
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
    </ClientLayout>
  );
}
