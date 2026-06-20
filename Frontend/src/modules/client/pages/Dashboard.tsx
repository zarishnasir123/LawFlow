import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import StatCard from "../../../shared/components/dashboard/StatCard";
import UpcomingHearings from "../../../shared/components/dashboard/UpcomingHearings";
import ClientRecentActivity from "../components/dashboard/ClientRecentActivity";
import ClientRecentCases from "../components/dashboard/ClientRecentCases";

import { useCurrentUser, displayFullName } from "../../auth/hooks/useCurrentUser";
import { useEnforcePasswordChange } from "../../auth/hooks/useEnforcePasswordChange";
import { getStoredAuthUser } from "../../auth/utils/authStorage";
import { mySignaturesApi } from "../../../shared/api/mySignatures.api";
import { clientHearingsApi } from "../api/hearings.api";
import { listMyCases } from "../api/cases.api";
import { getClientThreads } from "../api";

import type {
  DashboardStat,
  HearingItem,
  QuickActionItem,
} from "../../../shared/types/dashboard";

export default function Dashboard() {
  const navigate = useNavigate();
  useEnforcePasswordChange();
  const { data: currentUser } = useCurrentUser();

  // All dashboard data pulls live from the backend via TanStack Query, so the
  // numbers always match the dedicated pages and refresh on their own.
  const casesQuery = useQuery({
    queryKey: ["client", "cases"],
    queryFn: listMyCases,
  });
  const threadsQuery = useQuery({
    queryKey: ["client", "threads"],
    queryFn: getClientThreads,
    refetchInterval: 30_000,
  });
  const hearingsQuery = useQuery({
    queryKey: ["client", "my-hearings"],
    queryFn: () => clientHearingsApi.listMyHearings(),
  });
  const signaturesQuery = useQuery({
    queryKey: ["client", "pending-signatures"],
    queryFn: () => mySignaturesApi.listPending(),
  });

  // Active = cases that are in motion (exclude unsubmitted drafts + closed/disposed).
  const activeCases = useMemo(
    () =>
      (casesQuery.data ?? []).filter(
        (c) => c.status !== "draft" && c.status !== "disposed"
      ).length,
    [casesQuery.data]
  );

  // Total unread chat messages across all of the client's conversations.
  const unreadMessages = useMemo(
    () =>
      (threadsQuery.data ?? []).reduce(
        (sum, t) => sum + (t.unreadCount ?? 0),
        0
      ),
    [threadsQuery.data]
  );

  const pendingSignatures = signaturesQuery.data?.length ?? 0;

  // Upcoming = scheduled or proposed hearings; show the soonest 2 in the panel.
  const upcoming = useMemo(
    () =>
      (hearingsQuery.data ?? []).filter(
        (h) => h.status === "scheduled" || h.status === "proposed"
      ),
    [hearingsQuery.data]
  );

  const upcomingHearings: HearingItem[] = useMemo(
    () =>
      upcoming.slice(0, 2).map((h) => ({
        id: String(h.id),
        caseNumber: `Hearing #${h.hearingNumber} (${h.hearingType})`,
        title: h.caseTitle,
        dateTime:
          h.status === "proposed"
            ? `${h.hearingDate} at ${h.startTime} — Pending Confirmation`
            : `${h.hearingDate} at ${h.startTime} (${h.courtroomName})`,
      })),
    [upcoming]
  );

  // Three-tier fallback to kill the login-time name flicker (live user, then the
  // name cached at login, then empty).
  const displayName =
    displayFullName(currentUser) || getStoredAuthUser()?.name || "";
  const greeting = currentUser?.firstLoginCompleted ? "Welcome back" : "Welcome";
  const signedInEmail = currentUser?.email ?? "";

  // Show a dash while a stat's source is still loading, the number once it lands.
  const statValue = (isLoading: boolean, value: number): string =>
    isLoading ? "—" : String(value);

  const stats: DashboardStat[] = [
    {
      label: "Active Cases",
      value: statValue(casesQuery.isLoading, activeCases),
      icon: FileText,
      accentClassName: "bg-blue-500",
      onClick: () => navigate({ to: "/client-my-cases" }),
    },
    {
      label: "Upcoming Hearings",
      value: statValue(hearingsQuery.isLoading, upcoming.length),
      icon: Calendar,
      accentClassName: "bg-purple-500",
      onClick: () => navigate({ to: "/client-hearings" }),
    },
    {
      label: "Pending Signatures",
      value: statValue(signaturesQuery.isLoading, pendingSignatures),
      icon: PenTool,
      accentClassName: "bg-yellow-500",
      onClick: () => navigate({ to: "/case-tracking", search: { view: "pending" } }),
    },
    {
      label: "Messages",
      value: statValue(threadsQuery.isLoading, unreadMessages),
      icon: MessageCircle,
      accentClassName: "bg-green-500",
      onClick: () => navigate({ to: "/client-messages" }),
    },
  ];

  const quickActions: QuickActionItem[] = [
    { label: "My Cases", icon: BriefcaseBusiness, className: "bg-[#01411C] hover:bg-[#024a23]", to: "/client-my-cases" },
    { label: "Find a Lawyer", icon: Gavel, className: "bg-[#01411C] hover:bg-[#024a23]", to: "/FindLawyer" },
    { label: "Pending Signatures", icon: PenTool, className: "bg-yellow-600 hover:bg-yellow-700", to: "/case-tracking?view=pending" },
    { label: "Payments", icon: DollarSign, className: "bg-[#01411C] hover:bg-[#024a23]", to: "/client-payments" },
    { label: "Messages", icon: MessageCircle, className: "bg-[#01411C] hover:bg-[#024a23]", to: "/client-messages" },
    { label: "Hearings", icon: Calendar, className: "bg-[#01411C] hover:bg-[#024a23]", to: "/client-hearings" },
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
            <ClientRecentCases
              onViewAll={() => navigate({ to: "/client-my-cases" })}
              onSelectCase={() => navigate({ to: "/client-my-cases" })}
            />
          </div>

          <div className="space-y-6">
            <UpcomingHearings
              hearings={upcomingHearings}
              onNavigate={() => navigate({ to: "/client-hearings" })}
            />
            <ClientRecentActivity />
          </div>
        </section>
      </ClientLayout>
    </>
  );
}
