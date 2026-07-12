import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { DollarSign, FileText, FolderOpen, Star } from "lucide-react";
import LawyerLayout from "../components/LawyerLayout";
import StatCard from "../../../shared/components/dashboard/StatCard";
import UpcomingHearings from "../../../shared/components/dashboard/UpcomingHearings";
import QuickActions from "../../../shared/components/dashboard/QuickActions";
import LawyerRecentActivity from "../components/dashboard/LawyerRecentActivity";
import LawyerRecentCases from "../components/dashboard/LawyerRecentCases";
import { useCurrentUser, displayFullName } from "../../auth/hooks/useCurrentUser";
import { useEnforcePasswordChange } from "../../auth/hooks/useEnforcePasswordChange";
import { useSignatureRequestsStore } from "../signatures/store/signatureRequests.store";
import { casesApi } from "../api/cases.api";
import { lawyerHearingsApi } from "../api/hearings.api";
import { useMemo } from "react";
import { lawyerDashboardQuickActions } from "../data/dashboard.mock";
import { getLawyerThreads } from "../api";
// Compact PKR formatting for the Total Earnings tile: large amounts collapse to
// "Rs. 450K" / "Rs. 1.2M" so the number fits the card; smaller amounts show
// with thousands separators. null → "Rs. —" (no clean earnings source).
function formatEarnings(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Rs. —";
  if (value >= 1_000_000) {
    return `Rs. ${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `Rs. ${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
  }
  return `Rs. ${value.toLocaleString("en-PK")}`;
}

export default function LawyerDashboard() {
  const navigate = useNavigate();
  useEnforcePasswordChange();
  const { data: currentUser } = useCurrentUser();
  useSignatureRequestsStore();

  // Live lawyer-scoped stat tiles (active cases / pending submissions / client
  // signed / total earnings). Backend scopes every count to req.user.sub.
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery({
    queryKey: ["lawyer", "dashboard-stats"],
    queryFn: casesApi.getDashboardStats,
    // Keep the stat tiles (esp. Total Earnings) fresh: refetch on mount and
    // when the lawyer returns to the tab, so they reflect new payments/payouts
    // without a manual reload — and stay in step with the Earnings page.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: upcomingHearingsList = [] } = useQuery({
    queryKey: ["lawyer", "hearings"],
    queryFn: lawyerHearingsApi.listMyHearings,
  });

  // Unread chat messages across all of the lawyer's conversations — drives the
  // count bubble on the "Messages" quick action. Polls every 30s so it climbs
  // as new messages arrive without a manual reload.
  const threadsQuery = useQuery({
    queryKey: ["lawyer", "threads"],
    queryFn: getLawyerThreads,
    refetchInterval: 30_000,
  });
  const unreadMessages = useMemo(
    () =>
      (threadsQuery.data ?? []).reduce(
        (sum, t) => sum + (t.unreadCount ?? 0),
        0
      ),
    [threadsQuery.data]
  );
  const quickActions = useMemo(
    () =>
      lawyerDashboardQuickActions.map((a) =>
        a.to === "/lawyer-messages" ? { ...a, badge: unreadMessages } : a
      ),
    [unreadMessages]
  );

  const formattedHearings = useMemo(() => {
    return upcomingHearingsList
      .filter((h) => h.status === "scheduled" || h.status === "proposed")
      .slice(0, 2)
      .map((h) => ({
        id: h.id,
        caseNumber: `Hearing #${h.hearingNumber} (${h.hearingType})`,
        title: h.caseTitle,
        dateTime: h.status === "proposed"
          ? `${h.hearingDate} at ${h.startTime} — Pending Confirmation`
          : `${h.hearingDate} at ${h.startTime} (${h.courtroomName})`
      }));
  }, [upcomingHearingsList]);

  // While loading we show a subtle dash placeholder; on error we fall back to
  // 0 / "Rs. —" so the dashboard still renders rather than blanking out.
  const statsReady = !statsLoading && !statsError && stats !== undefined;
  const statValue = (value: number | undefined): string =>
    statsReady && value !== undefined ? String(value) : "—";

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
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {/* Active Cases — all of the lawyer's cases, any status (live). */}
          <StatCard
            label="Active Cases"
            value={statValue(stats?.activeCases)}
            icon={FileText}
            accentClassName="bg-blue-500"
          />
          {/* Pending Submissions — cases awaiting the registrar's decision. */}
          <StatCard
            label="Pending Submissions"
            value={statValue(stats?.pendingSubmissions)}
            icon={FolderOpen}
            accentClassName="bg-yellow-500"
          />
          {/* Total Earnings — lawyer's received money from successful payments;
              "Rs. —" while loading / on error / when null. */}
          <StatCard
            label="Total Earnings"
            value={statsReady ? formatEarnings(stats.totalEarnings) : "Rs. —"}
            icon={DollarSign}
            accentClassName="bg-purple-500"
          />
          {/* Client Signed — distinct cases where the client has signed (live). */}
          <StatCard
            label="Client Signed"
            value={statValue(stats?.clientSigned)}
            icon={FileText}
            accentClassName="bg-emerald-500"
          />
          {/* Average Rating — mean of the lawyer's visible client reviews (live). */}
          <StatCard
            label="Average Rating"
            value={
              statsReady && stats.averageRating !== null
                ? `${stats.averageRating.toFixed(1)} / 5`
                : "—"
            }
            icon={Star}
            accentClassName="bg-amber-500"
          />
        </section>

        {/* QUICK ACTIONS */}
        <section className="mt-8">
          <QuickActions
            actions={quickActions}
            onNavigate={(to) => navigate({ to })}
          />
        </section>

        {/* CASES + ACTIVITY */}
        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {/* PANEL 1: My Cases — 2 most recent real cases for this lawyer. */}
            <LawyerRecentCases
              onViewAll={() => navigate({ to: "/lawyer-cases" })}
              onSelectCase={(caseItem) =>
                navigate({ to: `/lawyer-case-editor/${caseItem.id}` })
              }
            />
          </div>

          <div className="space-y-6">
            {/* Upcoming Hearings — Real-time hearings from the backend. */}
            <UpcomingHearings
              hearings={formattedHearings}
              onNavigate={() => navigate({ to: "/lawyer-hearings" })}
            />
            {/* PANEL 2: Recent Activity — real lawyer feed. */}
            <LawyerRecentActivity />
          </div>
        </section>
    </LawyerLayout>
  );
}
