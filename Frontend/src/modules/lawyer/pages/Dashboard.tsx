import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Calendar,
  FileText,
  LogOut,
  MessageCircle,
  User,
  FolderOpen,
  DollarSign,
  Sparkles,
} from "lucide-react";

import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import StatCard from "../../../shared/components/dashboard/StatCard";
import RecentActivity from "../../../shared/components/dashboard/RecentActivity";
import RecentCases from "../../../shared/components/dashboard/RecentCases";
import UpcomingHearings from "../../../shared/components/dashboard/UpcomingHearings";
import QuickActions from "../../../shared/components/dashboard/QuickActions";

import type {
  ActivityItem,
  CaseItem,
  DashboardStat,
  HearingItem,
  QuickActionItem,
} from "../../../shared/types/dashboard";

export default function LawyerDashboard() {
  const navigate = useNavigate();

  /* =======================
     STATS
  ======================= */
  const stats: DashboardStat[] = [
    { label: "Active Cases", value: "8", icon: FileText, accentClassName: "bg-blue-500" },
    {
      label: "Pending Submissions",
      value: "2",
      icon: FolderOpen,
      accentClassName: "bg-yellow-500",
    },
    {
      label: "Client Messages",
      value: "5",
      icon: MessageCircle,
      accentClassName: "bg-green-500",
    },
    {
      label: "Total Earnings",
      value: "₨ 450K",
      icon: DollarSign,
      accentClassName: "bg-purple-500",
    },
  ];

  /* =======================
     QUICK ACTIONS (IMPORTANT)
  ======================= */
  const quickActions: QuickActionItem[] = [
    {
      label: "New Case",
      icon: FileText,
      className: "bg-[#01411C] hover:bg-[#024a23]",
      to: "/lawyer-new-case",
    },
    {
      label: "AI Assistant",
      icon: Sparkles,
      className: "bg-purple-600 hover:bg-purple-700",
      to: "/lawyer-ai",
    },
    {
      label: "Returned Cases",
      icon: FolderOpen,
      className: "bg-red-600 hover:bg-red-700",
      to: "/lawyer-returned-cases",
    },
    {
      label: "Signatures",
      icon: FileText,
      className: "bg-purple-600 hover:bg-purple-700",
      to: "/lawyer-document-review",
    },
    {
      label: "Messages",
      icon: MessageCircle,
      className: "bg-[#01411C] hover:bg-[#024a23]",
      to: "/lawyer-chat",
    },
    {
      label: "Hearings",
      icon: Calendar,
      className: "bg-[#01411C] hover:bg-[#024a23]",
      to: "/lawyer-hearings",
    },
  ];

  /* =======================
     CASES
  ======================= */
  const cases: CaseItem[] = [
    {
      id: 1,
      caseNumber: "LC-2024-0156",
      title: "Property Dispute Resolution",
      lawyer: "Ahmed Khan",
      status: "Hearing Scheduled",
      lastUpdate: "Today",
      nextHearing: "January 30, 2025",
    },
    {
      id: 2,
      caseNumber: "LC-2024-0142",
      title: "Contract Breach Settlement",
      lawyer: "Ali Hassan",
      status: "In Review",
      lastUpdate: "Yesterday",
      nextHearing: "February 5, 2025",
    },
  ];

  /* =======================
     HEARINGS
  ======================= */
  const hearings: HearingItem[] = [
    {
      id: 1,
      caseNumber: "LC-2024-0156",
      title: "Property Dispute",
      dateTime: "January 30, 2025 • 10:00 AM",
    },
  ];

  /* =======================
     ACTIVITY
  ======================= */
  const activityItems: ActivityItem[] = [
    { id: 1, label: "Case approved by registrar", time: "1 hour ago", type: "case" },
    { id: 2, label: "New message from client", time: "3 hours ago", type: "message" },
  ];

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
          Welcome back, Adv. Fatima Ali
        </h2>
        <p className="text-sm text-gray-600">
          Manage your cases, clients, and hearings efficiently.
        </p>
      </div>

      {/* STATS */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      {/* QUICK ACTIONS ✅ */}
      <section className="mt-6">
        <QuickActions
          actions={quickActions}
          onNavigate={(to) => navigate({ to })}
        />
      </section>

      {/* CASES + ACTIVITY */}
      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentCases
            cases={cases}
            onViewAll={() => navigate({ to: "/lawyer-cases" })}
            onSelectCase={() => navigate({ to: "/lawyer-cases" })}
          />
        </div>

        <div className="space-y-6">
          <UpcomingHearings
            hearings={hearings}
            onNavigate={() => navigate({ to: "/lawyer-hearings" })}
          />
          <RecentActivity items={activityItems} />
        </div>
      </section>
    </DashboardLayout>
  );
}
