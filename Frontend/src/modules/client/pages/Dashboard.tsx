import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  Calendar,
  DollarSign,
  FileText,
  Gavel,
  MessageCircle,
  PenTool,
} from "lucide-react";

import ClientLayout from "../components/ClientLayout";
import QuickActions from "../../../shared/components/dashboard/QuickActions";
import RecentActivity from "../../../shared/components/dashboard/RecentActivity";
import RecentCases from "../../../shared/components/dashboard/RecentCases";
import StatCard from "../../../shared/components/dashboard/StatCard";
import UpcomingHearings from "../../../shared/components/dashboard/UpcomingHearings";

import { useCurrentUser, displayFullName } from "../../auth/hooks/useCurrentUser";
import { useEnforcePasswordChange } from "../../auth/hooks/useEnforcePasswordChange";
import { getStoredAuthUser } from "../../auth/utils/authStorage";
import { mySignaturesApi } from "../../../shared/api/mySignatures.api";
import { clientHearingsApi } from "../api/hearings.api";

import type {
  ActivityItem,
  CaseItem,
  DashboardStat,
  HearingItem,
  QuickActionItem,
} from "../../../shared/types/dashboard";

export default function Dashboard() {
  const navigate = useNavigate();
  useEnforcePasswordChange();
  const { data: currentUser } = useCurrentUser();
  // Pending-signatures stat tile pulls live from the backend so the
  // count matches the dedicated Pending Signatures page. Refreshes on
  // dashboard mount; the page itself does its own refresh.
  const [pendingSignatureCount, setPendingSignatureCount] = useState(0);
  const [upcomingHearings, setUpcomingHearings] = useState<HearingItem[]>([]);

  useEffect(() => {
    clientHearingsApi
      .listMyHearings()
      .then((rows) => {
        const formatted = rows
          .filter((h) => h.status === "scheduled" || h.status === "proposed")
          .slice(0, 2)
          .map((h) => ({
            id: h.id as any,
            caseNumber: `Hearing #${h.hearingNumber} (${h.hearingType})`,
            title: h.caseTitle,
            dateTime: h.status === "proposed"
              ? `${h.hearingDate} at ${h.startTime} — Pending Confirmation`
              : `${h.hearingDate} at ${h.startTime} (${h.courtroomName})`
          }));
        setUpcomingHearings(formatted);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    mySignaturesApi
      .listPending()
      .then((rows) => {
        if (!cancelled) setPendingSignatureCount(rows.length);
      })
      .catch(() => {
        // Quiet fail — leave count at 0 if the endpoint is unreachable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Three-tier fallback to kill the login-time flicker:
  //   1. The live `/auth/me` user once Tanstack Query resolves it.
  //   2. The name we wrote to (local|session)Storage at login —
  //      available synchronously, so the very first paint already
  //      has the real name instead of a generic "Client" placeholder.
  //   3. Empty string as a last resort (the greeting just becomes
  //      "Welcome" until the query lands).
  const displayName =
    displayFullName(currentUser) || getStoredAuthUser()?.name || "";
  const greeting = currentUser?.firstLoginCompleted ? "Welcome back" : "Welcome";
  const signedInEmail = currentUser?.email ?? "";

  const stats: DashboardStat[] = [
    { label: "Active Cases", value: "2", icon: FileText, accentClassName: "bg-blue-500" },
    { label: "Upcoming Hearings", value: String(upcomingHearings.length), icon: Calendar, accentClassName: "bg-purple-500", onClick: () => navigate({ to: "/client-hearings" }) },
    {
      label: "Pending Signatures",
      value: String(pendingSignatureCount || 0),
      icon: FileText,
      accentClassName: "bg-yellow-500",
      onClick: () => navigate({ to: "/case-tracking", search: { view: "pending" } }),
    },
    { label: "Messages", value: "3", icon: MessageCircle, accentClassName: "bg-green-500" },
  ];

  const quickActions: QuickActionItem[] = [
    { label: "My Cases", icon: BriefcaseBusiness, className: "bg-[#01411C] hover:bg-[#024a23]", to: "/client-my-cases" },
    { label: "Find a Lawyer", icon: Gavel, className: "bg-[#01411C] hover:bg-[#024a23]", to: "/FindLawyer" },
    { label: "Pending Signatures", icon: PenTool, className: "bg-yellow-600 hover:bg-yellow-700", to: "/case-tracking?view=pending" },
    { label: "Payments", icon: DollarSign, className: "bg-[#01411C] hover:bg-[#024a23]", to: "/client-payments" },
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

  const activityItems: ActivityItem[] = [
    { id: 1, label: "New message from lawyer", time: "2 hours ago", type: "message" },
    { id: 2, label: "Case status updated", time: "1 day ago", type: "case" },
  ];

  return (
    <>
      <ClientLayout brandSubtitle="Client Dashboard">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {greeting}, <span className="text-[var(--primary)]">{displayName}</span>
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-gray-600">
            Track your cases, connect with lawyers, and manage documents in one place.
          </p>
          {signedInEmail && (
            <p className="mt-1 text-xs text-gray-500">Signed in as {signedInEmail}</p>
          )}
        </header>

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </section>

        <section className="mt-8">
          <QuickActions actions={quickActions} onNavigate={(to) => navigate({ to })} />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentCases
              cases={recentCases}
              onViewAll={() => navigate({ to: "/client-my-cases" })}
              onSelectCase={() => navigate({ to: "/client-my-cases" })}
            />
          </div>

          <div className="space-y-6">
            <UpcomingHearings hearings={upcomingHearings} onNavigate={() => navigate({ to: "/client-hearings" })} />
            <RecentActivity items={activityItems} />
          </div>
        </section>
      </ClientLayout>
    </>
  );
}
