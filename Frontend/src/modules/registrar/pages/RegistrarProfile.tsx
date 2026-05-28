import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import RegistrarLayout from "../components/RegistrarLayout";
import ProfileCard from "../../../shared/components/profile/ProfileCard";
import ProfileField from "../../../shared/components/profile/ProfileField";
import ChangePasswordModal from "./components/modals/ChangePasswordModal";
import DeactivateAccountModal from "./components/modals/DeactivateAccountModal";
import {
  useCurrentUser,
  displayFullName,
} from "../../auth/hooks/useCurrentUser";
import { useEnforcePasswordChange } from "../../auth/hooks/useEnforcePasswordChange";
import { authApi, getAuthErrorMessage } from "../../auth/api";
import { clearStoredAuth } from "../../auth/utils/authStorage";

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

export default function RegistrarProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Same enforce-gate the dashboard runs — a registrar with a still-temp
  // password should land on /change-temp-password before they can see
  // any profile data.
  useEnforcePasswordChange();
  const { data: currentUser, isLoading } = useCurrentUser();

  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const deactivateMutation = useMutation({
    mutationFn: authApi.deactivateMyAccount,
    onSuccess: () => {
      // Backend revokes every session + queues the confirmation email
      // in the same transaction. Wipe local auth so redirectIfAuthenticated
      // doesn't bounce us back to /registrar-dashboard. 30-day recovery
      // window lets the registrar sign back in to silently reactivate.
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

  // Disable background scroll while any modal is open.
  useEffect(() => {
    const anyOpen = showChangePasswordModal || showDeactivateModal;
    if (anyOpen) {
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
      <RegistrarLayout pageSubtitle="My Profile">
        <div className="px-6 py-8">
          <div className="max-w-4xl mx-auto bg-white rounded-xl border p-6 text-sm text-gray-500">
            Loading profile…
          </div>
        </div>
      </RegistrarLayout>
    );
  }

  const fullName = displayFullName(currentUser);
  const memberSince = formatMemberSince(currentUser.createdAt);
  const roleLabel = capitalize(currentUser.role);

  return (
    <RegistrarLayout pageSubtitle="My Profile">
      <div className="px-6 py-8">
        {/* Edit button takes the registrar to the dedicated edit page
            where they can update name / email / phone / avatar. CNIC,
            court, and tehsil stay locked there (admin-managed and
            backend-enforced). Account-level controls (change password,
            deactivate) remain on this view below. */}
        <ProfileCard
          name={fullName}
          memberSince={memberSince}
          roleLabel={roleLabel}
          avatarUrl={currentUser.avatarUrl}
          onEdit={() => navigate({ to: "/registrar-profile/edit" })}
        >
          {/* Identity — admin-provisioned, read-only here */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProfileField label="Full Name" value={fullName} />
            <ProfileField label="Email Address" value={currentUser.email} />
            <ProfileField label="Phone Number" value={currentUser.phone ?? ""} />
            <ProfileField label="CNIC Number" value={currentUser.cnic ?? ""} />
          </div>

          {/* Court assignment — sourced from registrar_profiles. Empty
              placeholder when the admin hasn't assigned one yet so the
              slot still communicates "this exists". */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProfileField
              label="Assigned Court"
              value={currentUser.assignedCourt ?? "Not assigned"}
            />
            <ProfileField
              label="Assigned Tehsil"
              value={currentUser.assignedTehsil ?? "Not assigned"}
            />
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Registrar identity and court assignment are managed by the system
            administrator. Contact your admin if any of the details above need
            to change.
          </div>

          {/* Account Settings — self-service for the registrar */}
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
    </RegistrarLayout>
  );
}
