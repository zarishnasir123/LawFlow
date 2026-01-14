import { useNavigate } from "@tanstack/react-router";
import { Users, UserCheck, Clock, CheckCircle, Activity, Shield } from "lucide-react";

import { AdminHeader } from "../components/AdminHeader";
import { ActionCard } from "../components/ActionCard";
import { PendingVerificationList } from "../components/PendingVerificationList";
import { RecentActivityList } from "../components/RecentActivity";

import { adminDashboardStats, adminPendingVerifications, adminRecentActivity } from "../dashboard.mock";


export default function AdminDashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader
        notificationCount={3}
        onOpenNotifications={() => navigate({ to: "/admin-notifications" })}
        onOpenProfile={() => navigate({ to: "/admin-profile" })}
        onLogout={() => {
          localStorage.clear();
          navigate({ to: "/login" });
        }}
      />

      <div className="container mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-green-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#01411C] mb-2">
                Welcome back, Admin
              </h2>
              <p className="text-gray-600">Here's what's happening with LawFlow today.</p>
            </div>
            <Shield className="h-16 w-16 text-[#01411C] opacity-20" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {adminDashboardStats.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div key={idx} className="bg-white rounded-xl shadow-sm p-6">
                <div className={`${s.colorClass} w-fit p-3 rounded-lg mb-4`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">{s.value}</h3>
                <p className="text-sm text-gray-600 mb-2">{s.title}</p>
                <p className="text-xs text-gray-500">{s.change}</p>
              </div>
            );
          })}
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <ActionCard
            title="Pending Verifications"
            description="Review and approve user registrations"
            badgeText="12 Pending"
            icon={Clock}
            iconBgClass="bg-yellow-100"
            iconTextClass="text-yellow-600"
            badgeClassName="bg-yellow-100 text-yellow-700"
            onClick={() => navigate({ to: "/admin-verifications" })}
          />

          <ActionCard
            title="Manage Registrars"
            description="Create and manage registrar accounts"
            badgeText="8 Active"
            icon={UserCheck}
            iconBgClass="bg-blue-100"
            iconTextClass="text-blue-600"
            badgeClassName="bg-blue-100 text-blue-700"
            onClick={() => navigate({ to: "/admin-registrars" })}
          />

          <ActionCard
            title="System Reports"
            description="View system activity and analytics"
            badgeText="View Reports"
            icon={Activity}
            iconBgClass="bg-purple-100"
            iconTextClass="text-purple-600"
            badgeClassName="bg-purple-100 text-purple-700"
            onClick={() => navigate({ to: "/admin-statistics" })}
          />
        </div>

        {/* Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PendingVerificationList
            items={adminPendingVerifications}
            onViewAll={() => navigate({ to: "/admin-verifications" })}
            onReview={(item) => {
              console.log("Review user:", item);
              navigate({ to: "/admin-verifications" });
            }}
          />

          <RecentActivityList items={adminRecentActivity} />
        </div>
      </div>
    </div>
  );
}
