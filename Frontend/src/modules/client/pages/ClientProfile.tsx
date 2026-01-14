import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import ProfileCard from "../../../shared/components/profile/ProfileCard";
import ProfileField from "../../../shared/components/profile/ProfileField";

export default function ClientProfile() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    fullName: "Ahmed Khan",
    email: "ahmed.khan@example.com",
    phone: "+92 300 1234567",
    cnic: "12345-1234567-1",
    address: "House 123, Street 45, F-7, Islamabad",
  });

  // 🔹 Load saved profile data
  useEffect(() => {
    const savedProfile = localStorage.getItem("clientProfile");
    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    }
  }, []);

  return (
    <DashboardLayout
      brandTitle={
        <div
          className="flex items-start gap-3 cursor-pointer"
          onClick={() => navigate({ to: "/client-profile" })}
        >
          <ArrowLeft className="mt-1 h-5 w-5 text-white" />
          <div className="flex flex-col">
            <span className="text-lg font-semibold">My Profile</span>
            <p className="text-sm text-green-100">
              View and manage your personal information
            </p>
          </div>
        </div>
      }
    >
      <ProfileCard
        name={profile.fullName}
        memberSince="January 15, 2024"
        roleLabel="Client"
        onEdit={() => navigate({ to: "/client-profile/edit" })}
      >
        {/* Grid */}
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
              onClick={() => navigate({ to: "/" })}
              className="border px-4 py-2 rounded-md text-sm hover:bg-gray-50"
            >
              Change Password
            </button>

            <button
              onClick={() => navigate({ to: "/" })}
              className="border px-4 py-2 rounded-md text-sm hover:bg-gray-50"
            >
              Notification Preferences
            </button>

            <button
              onClick={() => navigate({ to: "/" })}
              className="border border-red-500 text-red-600 px-4 py-2 rounded-md text-sm hover:bg-red-50"
            >
              Deactivate Account
            </button>
          </div>
        </div>
      </ProfileCard>
    </DashboardLayout>
  );
}
