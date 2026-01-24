import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Calendar,
  FileText,
  Gavel,
  LogOut,
  MessageCircle,
  PenTool,
  Upload,
  User,
} from "lucide-react";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import QuickActions from "../../../shared/components/dashboard/QuickActions";
import RecentActivity from "../../../shared/components/dashboard/RecentActivity";
import RecentCases from "../../../shared/components/dashboard/RecentCases";
import StatCard from "../../../shared/components/dashboard/StatCard";
import UpcomingHearings from "../../../shared/components/dashboard/UpcomingHearings";
import { useLoginStore } from "../../auth/store";
import type {
  ActivityItem,
  CaseItem,
  DashboardStat,
  HearingItem,
  QuickActionItem,
} from "../../../shared/types/dashboard";

export default function Dashboard() {
  const navigate = useNavigate();
  const email = useLoginStore((state) => state.email);

  const displayName = (() => {
    if (!email) return "Client";
    const handle = email.split("@")[0] ?? "";
    if (!handle) return "Client";
    return handle
      .replace(/[._-]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  })();

  const stats: DashboardStat[] = [
    {
      label: "Active Cases",
      value: "2",
      icon: FileText,
      accentClassName: "bg-blue-500",
    },
    {
      label: "Upcoming Hearings",
      value: "1",
      icon: Calendar,
      accentClassName: "bg-purple-500",
    },
    {
      label: "Pending Signatures",
      value: "1",
      icon: FileText,
      accentClassName: "bg-yellow-500",
    },
    {
      label: "Messages",
      value: "3",
      icon: MessageCircle,
      accentClassName: "bg-green-500",
    },
  ];

  const quickActions: QuickActionItem[] = [
    {
      label: "Find a Lawyer",
      icon: Gavel,
      className: "bg-[#01411C] hover:bg-[#024a23]",
      to: "/FindLawyer",
    },
    {
      label: "Pending Signatures",
      icon: PenTool,
      className: "bg-yellow-600 hover:bg-yellow-700",
      to: "/client-dashboard",
    },
    {
      label: "Upload Documents",
      icon: Upload,
      className: "bg-[#01411C] hover:bg-[#024a23]",
      to: "/client-dashboard",
    },
    {
      label: "Messages",
      icon: MessageCircle,
      className: "bg-[#01411C] hover:bg-[#024a23]",
      to: "/client-messages",
    },
    {
      label: "Hearings",
      icon: Calendar,
      className: "bg-[#01411C] hover:bg-[#024a23]",
      to: "/client-hearings",
    },
  ];

  const recentCases: CaseItem[] = [
    {
      id: 1,
      caseNumber: "LC-2024-0156",
      title: "Property Dispute Resolution",
      lawyer: "Adv. Fatima Ali",
      status: "Hearing Scheduled",
      lastUpdate: "2 hours ago",
      nextHearing: "January 30, 2025",
    },
    {
      id: 2,
      caseNumber: "LC-2024-0142",
      title: "Contract Breach Settlement",
      lawyer: "Adv. Hassan Ahmed",
      status: "In Review",
      lastUpdate: "1 day ago",
      nextHearing: "February 5, 2025",
    },
  ];

  const hearings: HearingItem[] = [
    {
      id: 1,
      caseNumber: "LC-2024-0156",
      title: "Property Dispute",
      dateTime: "January 30, 2025 • 10:00 AM",
    },
  ];

  const activityItems: ActivityItem[] = [
    {
      id: 1,
      label: "New message from lawyer",
      time: "2 hours ago",
      type: "message",
    },
    { id: 2, label: "Case status updated", time: "1 day ago", type: "case" },
  ];

  const handleNavigate = (to: string) => navigate({ to });

  return (
    <DashboardLayout
      brandTitle="LawFlow"
      brandSubtitle="Client Portal"
      actions={[
        {
          label: "Notifications",
          icon: Bell,
          onClick: () => navigate({ to: "/client-dashboard" }),
          badge: 3,
        },
        {
          label: "Profile",
          icon: User,
          onClick: () => navigate({ to: "/client-profile" }),
        },
        {
          label: "Logout",
          icon: LogOut,
          onClick: () => navigate({ to: "/login" }),
        },
      ]}
    >
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Welcome back, {displayName}
        </h2>
        <p className="text-sm text-gray-600">
          Track your cases, connect with lawyers, and manage documents in one
          place.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="mt-6">
        <QuickActions actions={quickActions} onNavigate={handleNavigate} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentCases
            cases={recentCases}
            onViewAll={() => navigate({ to: "/" })}
            onSelectCase={() => navigate({ to: "/case-tracking" })}
          />
        </div>

        <div className="space-y-6">
          <UpcomingHearings
            hearings={hearings}
            onNavigate={() => navigate({ to: "/client-dashboard" })}
          />
          <RecentActivity items={activityItems} />
        </div>
      </section>
    </DashboardLayout>
  );
}
