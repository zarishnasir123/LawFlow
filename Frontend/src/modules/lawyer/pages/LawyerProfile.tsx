import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Bell, LogOut, User } from "lucide-react";
import { useEffect } from "react";
import ProfileCard from "../../../shared/components/profile/ProfileCard";
import ProfileField from "../../../shared/components/profile/ProfileField";
import { useLawyerProfileStore } from "../store/lawyerProfile.store";

export default function LawyerProfile() {
  const navigate = useNavigate();
  const { profile, initializeProfile } = useLawyerProfileStore();

  useEffect(() => {
    initializeProfile();
  }, [initializeProfile]);

  return (
    <div>
      {/* Custom Navbar Header */}
      <div className="sticky top-0 z-50 bg-green-700 text-white shadow-lg">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <ArrowLeft
              className="w-6 h-6 cursor-pointer hover:text-green-100 transition"
              onClick={() => navigate({ to: "/Lawyer-dashboard" })}
            />
            <div>
              <h1 className="text-xl font-semibold">My Profile</h1>
              <p className="text-sm text-green-100">View and manage your professional information</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate({ to: "/Lawyer-dashboard" })}
              className="p-2 hover:bg-green-600 rounded-lg transition"
              title="Notifications"
            >
              <div className="relative">
                <Bell className="w-6 h-6" />
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">3</span>
              </div>
            </button>
            <button
              onClick={() => navigate({ to: "/lawyer-profile" })}
              className="p-2 hover:bg-green-600 rounded-lg transition"
              title="Profile"
            >
              <User className="w-6 h-6" />
            </button>
            <button
              onClick={() => navigate({ to: "/login" })}
              className="p-2 hover:bg-green-600 rounded-lg transition"
              title="Logout"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-screen bg-gray-50 px-6 py-8">
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
      </div>
    </div>
  );
}

