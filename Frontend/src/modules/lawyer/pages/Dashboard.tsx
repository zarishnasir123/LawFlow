import { useNavigate } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import LawyerLayout from "../components/LawyerLayout";
import StatCard from "../../../shared/components/dashboard/StatCard";
import RecentActivity from "../../../shared/components/dashboard/RecentActivity";
import RecentCases from "../../../shared/components/dashboard/RecentCases";
import UpcomingHearings from "../../../shared/components/dashboard/UpcomingHearings";
import QuickActions from "../../../shared/components/dashboard/QuickActions";
import type { ActivityItem, CaseItem } from "../../../shared/types/dashboard";
import { useLoginStore } from "../../auth/store";
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
  const email = useLoginStore((state) => state.email);
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
    <LawyerLayout
      brandTitle="LawFlow"
      brandSubtitle="Lawyer Portal"
      pageSubtitle="Lawyer Dashboard"
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
          <StatCard
            label="Client Signed"
            value={String(signedCount)}
            icon={FileText}
            accentClassName="bg-emerald-500"
          />
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
