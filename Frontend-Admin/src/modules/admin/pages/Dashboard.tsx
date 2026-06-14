import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle,
  Clock,
  Shield,
  UserCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PendingVerificationList } from "../components/PendingVerificationList";
import { RecentActivityList } from "../components/RecentActivity";

import { getDashboardStats } from "../api/dashboardStats";
import { fetchPendingLawyers } from "../api/lawyerVerifications";
import { getRecentActivity } from "../api/recentActivity";

// Card with no live number yet (loading) shows a dash placeholder, never a 0.
const LOADING_PLACEHOLDER = "—";

// Format a count with thousands separators (e.g. 1248 -> "1,248").
function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

type StatCard = {
  title: string;
  icon: LucideIcon;
  colorClass: string;
  value: string;
  // sub caption; null = hide the sub-line entirely (no fake fallback).
  change: string | null;
};

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  // Live stats for the four cards. While fetching we render a dash for each
  // number; on error we fall back to a dash too (the dashboard stays usable).
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin", "dashboard-stats"],
    queryFn: getDashboardStats,
    staleTime: 1000 * 30,
  });

  // Recent Lawyer Verification Requests panel. Reuses the SAME cache key as the
  // Verifications page (["admin", "pending-lawyers"]) so navigating between the
  // two never re-fetches, and any approve/reject there refreshes this panel.
  // The page already returns newest-first; we take the 5 most recent.
  const { data: pendingLawyers, isLoading: pendingLoading } = useQuery({
    queryKey: ["admin", "pending-lawyers"],
    queryFn: () => fetchPendingLawyers({ limit: 50 }),
    staleTime: 1000 * 30,
  });

  const recentLawyerRequests = [...(pendingLawyers?.items ?? [])]
    .sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    )
    .slice(0, 5);

  // Recent Activity panel — the 8 most recent real system events.
  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ["admin", "recent-activity"],
    queryFn: getRecentActivity,
    staleTime: 1000 * 30,
  });

  const loading = statsLoading || !stats;

  // Keep the exact original card visuals (icon + colour + order); only the
  // number and sub-caption become real. A null metric hides its sub-line.
  const dashboardCards: StatCard[] = [
    {
      title: "Pending Verifications",
      icon: Clock,
      colorClass: "bg-yellow-500",
      value: loading ? LOADING_PLACEHOLDER : formatCount(stats.pendingVerifications),
      change:
        loading || stats.pendingVerificationsToday == null
          ? null
          : `+${stats.pendingVerificationsToday} today`,
    },
    {
      title: "Active Registrars",
      icon: UserCheck,
      colorClass: "bg-green-500",
      value: loading ? LOADING_PLACEHOLDER : formatCount(stats.activeRegistrars),
      // registrarsOnline is always null (no presence tracking) -> hide sub-line.
      change:
        loading || stats?.registrarsOnline == null
          ? null
          : `${stats.registrarsOnline} online`,
    },
    {
      title: "Total Users",
      icon: Users,
      colorClass: "bg-blue-500",
      value: loading ? LOADING_PLACEHOLDER : formatCount(stats.totalUsers),
      change:
        loading || stats.newUsersThisWeek == null
          ? null
          : `+${stats.newUsersThisWeek} this week`,
    },
    {
      title: "Verified Today",
      icon: CheckCircle,
      colorClass: "bg-purple-500",
      value: loading
        ? LOADING_PLACEHOLDER
        : stats.verifiedToday == null
          ? "—"
          : formatCount(stats.verifiedToday),
      change:
        loading || stats.approvedToday == null
          ? null
          : `${stats.approvedToday} approved`,
    },
  ];

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
            {dashboardCards.map((s, idx) => {
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
                  {s.change !== null && (
                    <p className="text-xs text-gray-500">{s.change}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PendingVerificationList
              title="Recent Lawyer Verification Requests"
              items={recentLawyerRequests}
              isLoading={pendingLoading}
              onViewAll={() => navigate({ to: "/verifications" })}
              onReview={() => navigate({ to: "/verifications" })}
            />

            <RecentActivityList
              items={recentActivity ?? []}
              isLoading={activityLoading}
            />
          </div>
    </div>
  );
}
