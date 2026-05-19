import { useNavigate } from "@tanstack/react-router";
import { BadgeCheck, BarChart3, FileText, Shield, UserCheck, UserX } from "lucide-react";

import { ActionCard } from "../components/ActionCard";
import { PendingVerificationList } from "../components/PendingVerificationList";
import { RecentActivityList } from "../components/RecentActivity";

import {
  adminDashboardStats,
  adminPendingVerifications,
  adminRecentActivity,
} from "../dashboard.mock";

import { useAdminNotificationsStore } from "../store/notifications.store";
import { usePendingLawyerCount } from "../hooks/usePendingLawyerCount";

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const addSystemStatisticsNotification = useAdminNotificationsStore(
    (state) => state.addSystemStatisticsNotification,
  );
  const pendingLawyerCount = usePendingLawyerCount();
  const lawyerVerificationItems = adminPendingVerifications.filter(
    (request) => request.type === "Lawyer",
  );

  return (
    <div className="w-full px-6 lg:px-8 xl:px-10 py-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#01411C] mb-2">
                  Welcome back, <span className="text-gray-900">Admin</span>
                </h1>
                <p className="text-[15px] leading-relaxed text-gray-600">
                  Monitor operations and manage core system controls.
                </p>
              </div>
              <Shield className="h-16 w-16 text-[#01411C] opacity-20" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {adminDashboardStats.map((s, idx) => {
              const Icon = s.icon;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
                >
                  <div className={`${s.colorClass} w-fit p-3 rounded-lg mb-4`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">
                    {s.value}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">{s.title}</p>
                  <p className="text-xs text-gray-500">{s.change}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-6 mb-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold tracking-tight text-gray-900">Quick Actions</h2>
              <p className="mt-1 text-sm text-gray-600">
                Manage registrars, templates, statistics, and lawyer verification.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              <ActionCard
                title="Manage Registrars"
                description="Create, assign, activate, and manage registrar accounts."
                badgeText="Open Registrar Management"
                icon={UserCheck}
                iconBgClass="bg-emerald-100"
                iconTextClass="text-emerald-700"
                badgeClassName="bg-emerald-100 text-emerald-700"
                onClick={() => navigate({ to: "/registrars" })}
              />

              <ActionCard
                title="Manage Template Documents"
                description="Upload, update, and maintain official legal templates."
                badgeText="Open Template Management"
                icon={FileText}
                iconBgClass="bg-cyan-100"
                iconTextClass="text-cyan-700"
                badgeClassName="bg-cyan-100 text-cyan-700"
                onClick={() => navigate({ to: "/templates" })}
              />

              <ActionCard
                title="Manage System Statistics"
                description="View filing trends, approval rates, and usage metrics."
                badgeText="Open Statistics"
                icon={BarChart3}
                iconBgClass="bg-indigo-100"
                iconTextClass="text-indigo-700"
                badgeClassName="bg-indigo-100 text-indigo-700"
                onClick={() => {
                  addSystemStatisticsNotification({
                    title: "System statistics viewed",
                    message:
                      "Admin opened the system statistics dashboard for latest metrics.",
                    severity: "info",
                  });
                  navigate({ to: "/statistics" });
                }}
              />

              <ActionCard
                title="Verify Lawyer"
                description="Verify lawyer registration by SJP listing or Bar Council license details."
                badgeText="Open Verification Console"
                icon={BadgeCheck}
                iconBgClass="bg-amber-100"
                iconTextClass="text-amber-700"
                badgeClassName="bg-amber-100 text-amber-700"
                pendingCount={pendingLawyerCount}
                onClick={() => navigate({ to: "/verifications" })}
              />

              <ActionCard
                title="Returned Registrations"
                description="Review lawyers returned by admin and the remarks sent to them."
                badgeText="Open Rejection History"
                icon={UserX}
                iconBgClass="bg-rose-100"
                iconTextClass="text-rose-700"
                badgeClassName="bg-rose-100 text-rose-700"
                onClick={() => navigate({ to: "/rejection-history" })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PendingVerificationList
              title="Recent Lawyer Verification Requests"
              items={lawyerVerificationItems}
              onViewAll={() => navigate({ to: "/verifications" })}
              onReview={() => navigate({ to: "/verifications" })}
            />

            <RecentActivityList items={adminRecentActivity} />
          </div>
    </div>
  );
}
