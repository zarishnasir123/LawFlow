import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Calendar, FileText, Gavel, MessageCircle, PenTool } from "lucide-react";

import ClientLayout from "../components/ClientLayout";
import QuickActions from "../../../shared/components/dashboard/QuickActions";
import RecentActivity from "../../../shared/components/dashboard/RecentActivity";
import RecentCases from "../../../shared/components/dashboard/RecentCases";
import StatCard from "../../../shared/components/dashboard/StatCard";
import UpcomingHearings from "../../../shared/components/dashboard/UpcomingHearings";

import { useLoginStore } from "../../auth/store";
import { useClientProfileStore } from "../store";

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
  const { profile, initializeProfile } = useClientProfileStore();

  useEffect(() => {
    initializeProfile();
  }, [initializeProfile]);

  const displayName = (() => {
    if (profile?.fullName) return profile.fullName;
    if (!email) return "Client";
    const handle = email.split("@")[0] ?? "";
    return handle
      .replace(/[._-]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  })();

  const stats: DashboardStat[] = [
    { label: "Active Cases", value: "2", icon: FileText, accentClassName: "bg-blue-500" },
    { label: "Upcoming Hearings", value: "1", icon: Calendar, accentClassName: "bg-purple-500" },
    {
      label: "Pending Signatures",
      value: "1",
      icon: FileText,
      accentClassName: "bg-yellow-500",
      onClick: () => navigate({ to: "/case-tracking", search: { view: "pending" } }),
    },
    { label: "Messages", value: "3", icon: MessageCircle, accentClassName: "bg-green-500" },
  ];

  const quickActions: QuickActionItem[] = [
    { label: "Find a Lawyer", icon: Gavel, className: "bg-[#01411C] hover:bg-[#024a23]", to: "/FindLawyer" },
    { label: "Pending Signatures", icon: PenTool, className: "bg-yellow-600 hover:bg-yellow-700", to: "/case-tracking?view=pending" },
    { label: "Messages", icon: MessageCircle, className: "bg-[#01411C] hover:bg-[#024a23]", to: "/client-messages" },
    { label: "Hearings", icon: Calendar, className: "bg-[#01411C] hover:bg-[#024a23]", to: "/client-hearings" },
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
    { id: 1, caseNumber: "LC-2024-0156", title: "Property Dispute", dateTime: "January 30, 2025 - 10:00 AM" },
  ];

  const activityItems: ActivityItem[] = [
    { id: 1, label: "New message from lawyer", time: "2 hours ago", type: "message" },
    { id: 2, label: "Case status updated", time: "1 day ago", type: "case" },
  ];

  return (
    <>
      <ClientLayout brandSubtitle="Client Dashboard">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Welcome back, {displayName}
          </h2>
          <p className="text-sm text-gray-600">
            Track your cases, connect with lawyers, and manage documents in one place.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </section>

        <section className="mt-6">
          <QuickActions actions={quickActions} onNavigate={(to) => navigate({ to })} />
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
            <UpcomingHearings hearings={hearings} onNavigate={() => navigate({ to: "/client-dashboard" })} />
            <RecentActivity items={activityItems} />
          </div>
        </section>
      </ClientLayout>
    </>
  );
}
