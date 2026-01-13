import { useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, User } from "lucide-react";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import StatCard from "../../../shared/components/dashboard/StatCard";
import RecentActivity from "../../../shared/components/dashboard/RecentActivity";
import RecentCases from "../../../shared/components/dashboard/RecentCases";
import UpcomingHearings from "../../../shared/components/dashboard/UpcomingHearings";
import QuickActions from "../../../shared/components/dashboard/QuickActions";
import { useLoginStore } from "../../auth/store";
import {
  lawyerDashboardActivity,
  lawyerDashboardCases,
  lawyerDashboardHearings,
  lawyerDashboardQuickActions,
  lawyerDashboardStats,
} from "../data/dashboard.mock";

export default function LawyerDashboard() {
  const navigate = useNavigate();
  const email = useLoginStore((state) => state.email);

  const displayName = (() => {
    if (!email) return "Lawyer";
    const handle = email.split("@")[0] ?? "";
    if (!handle) return "Lawyer";
    return handle
      .replace(/[._-]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  })();

  return (
    <DashboardLayout
      brandTitle="LawFlow"
      brandSubtitle="Lawyer Portal"
      actions={[
        {
          label: "Notifications",
          icon: Bell,
          onClick: () => navigate({ to: "/lawyer-notifications" }),
          badge: 2,
        },
        {
          label: "Profile",
          icon: User,
          onClick: () => navigate({ to: "/lawyer-profile" }),
        },
        {
          label: "Logout",
          icon: LogOut,
          onClick: () => navigate({ to: "/login" }),
        },
      ]}
    >
      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Welcome back, {displayName}
        </h2>
        <p className="text-sm text-gray-600">
          Manage your cases, clients, and hearings efficiently.
        </p>
      </div>

      {/* STATS */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {lawyerDashboardStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      {/* QUICK ACTIONS */}
      <section className="mt-6">
        <QuickActions
          actions={lawyerDashboardQuickActions}
          onNavigate={(to) => navigate({ to })}
        />
      </section>

      {/* CASES + ACTIVITY */}
      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentCases
            cases={lawyerDashboardCases}
            onViewAll={() => navigate({ to: "/lawyer-cases" })}
            onSelectCase={() => navigate({ to: "/lawyer-cases" })}
          />
        </div>

        <div className="space-y-6">
          <UpcomingHearings
            hearings={lawyerDashboardHearings}
            onNavigate={() => navigate({ to: "/lawyer-hearings" })}
          />
          <RecentActivity items={lawyerDashboardActivity} />
        </div>
      </section>
    </DashboardLayout>
  );
}
