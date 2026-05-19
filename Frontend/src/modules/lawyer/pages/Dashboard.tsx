import { useNavigate } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import LawyerLayout from "../components/LawyerLayout";
import StatCard from "../../../shared/components/dashboard/StatCard";
import RecentActivity from "../../../shared/components/dashboard/RecentActivity";
import RecentCases from "../../../shared/components/dashboard/RecentCases";
import UpcomingHearings from "../../../shared/components/dashboard/UpcomingHearings";
import QuickActions from "../../../shared/components/dashboard/QuickActions";
import type { ActivityItem, CaseItem } from "../../../shared/types/dashboard";
import { useCurrentUser, displayFullName } from "../../auth/hooks/useCurrentUser";
import { useSignatureRequestsStore } from "../signatures/store/signatureRequests.store";
import {
  lawyerDashboardActivity,
  lawyerDashboardCases,
  lawyerDashboardHearings,
  lawyerDashboardQuickActions,
  lawyerDashboardStats,
} from "../data/dashboard.mock";

export default function LawyerDashboard() {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const { requests } = useSignatureRequestsStore();
  const signedCount = requests.filter(
    (req) => req.clientSigned && req.sentToLawyerAt
  ).length;
  const signedActivity: ActivityItem[] =
    signedCount > 0
      ? [
          {
            id: 999,
            label: `${signedCount} document${signedCount !== 1 ? "s" : ""} signed by client`,
            time: "Just now",
            type: "case" as const,
          },
        ]
      : [];
  const dashboardActivity: ActivityItem[] = [
    ...signedActivity,
    ...lawyerDashboardActivity,
  ];

  const displayName = displayFullName(currentUser) || "Lawyer";
  const greeting = currentUser?.firstLoginCompleted ? "Welcome back" : "Welcome";

  return (
    <LawyerLayout
      brandTitle="LawFlow"
      brandSubtitle="Lawyer Portal"
      pageSubtitle="Lawyer Dashboard"
    >
        {/* HEADER */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {greeting}, <span className="text-[var(--primary)]">{displayName}</span>
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-gray-600">
            Manage your cases, clients, and hearings efficiently.
          </p>
          {currentUser?.email && (
            <p className="mt-1 text-xs text-gray-500">Signed in as {currentUser.email}</p>
          )}
        </header>

        {/* STATS */}
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {lawyerDashboardStats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
          <StatCard
            label="Client Signed"
            value={String(signedCount)}
            icon={FileText}
            accentClassName="bg-emerald-500"
          />
        </section>

        {/* QUICK ACTIONS */}
        <section className="mt-8">
          <QuickActions
            actions={lawyerDashboardQuickActions}
            onNavigate={(to) => navigate({ to })}
          />
        </section>

        {/* CASES + ACTIVITY */}
        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentCases
              cases={lawyerDashboardCases}
              onViewAll={() => navigate({ to: "/lawyer-cases" })}
              onSelectCase={(caseItem: CaseItem) => navigate({ to: `/lawyer-case-editor/${caseItem.id}` })}
            />
          </div>

          <div className="space-y-6">
            <UpcomingHearings
              hearings={lawyerDashboardHearings}
              onNavigate={() => navigate({ to: "/lawyer-hearings" })}
            />
            <RecentActivity items={dashboardActivity} />
          </div>
        </section>
    </LawyerLayout>
  );
}
