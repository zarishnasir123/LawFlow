import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  FileText,
  Search,
} from "lucide-react";
import Card from "../../../shared/components/dashboard/Card";
import QuickActions from "../../../shared/components/dashboard/QuickActions";
import StatCard from "../../../shared/components/dashboard/StatCard";
import type { DashboardStat, QuickActionItem } from "../../../shared/types/dashboard";
import { getCaseDisplayTitle } from "../../../shared/utils/caseDisplay";
import RegistrarLayout from "../components/RegistrarLayout";
import { useCaseFilingStore } from "../../lawyer/store/caseFiling.store";
import { useLoginStore } from "../../auth/store";
import {
  getFcfsSubmissionQueue,
  getProcessedCaseIdsForLatestSubmission,
} from "../utils/submissionQueue";
import { useRegistrarReviewDecisionStore } from "../store/reviewDecisions.store";

type QueueCase = {
  caseId: string;
  title: string;
  caseType: "Civil" | "Family";
  lawyer: string;
  client: string;
  submittedDate: string;
  submittedTime: string;
  documents: number;
};

export function RegistrarDashboard() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const email = useLoginStore((state) => state.email);
  const liveSubmittedCases = useCaseFilingStore((state) =>
    state.getSubmittedCasesForRegistrar()
  );
  const decisionsByCaseId = useRegistrarReviewDecisionStore(
    (state) => state.decisionsByCaseId
  );
  const returnedCasesCount = useRegistrarReviewDecisionStore(
    (state) => state.returnedCases.length
  );
  const displayName = (() => {
    if (!email) return "Registrar";
    const handle = email.split("@")[0] ?? "";
    if (!handle) return "Registrar";
    return handle
      .replace(/[._-]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  })();

  const queue = useMemo(
    () => getFcfsSubmissionQueue(liveSubmittedCases),
    [liveSubmittedCases]
  );
  const excludedCaseIds = useMemo(
    () => getProcessedCaseIdsForLatestSubmission(queue, decisionsByCaseId),
    [queue, decisionsByCaseId]
  );

  const submittedCases = useMemo(
    () => queue.filter((item) => !excludedCaseIds.has(item.caseId)),
    [queue, excludedCaseIds]
  );

  const queueCases: QueueCase[] = useMemo(
    () =>
      submittedCases.map((item) => ({
        caseId: item.caseId,
        title: getCaseDisplayTitle(item.title, item.caseId),
        caseType: item.caseType === "civil" ? "Civil" : "Family",
        lawyer: item.submittedBy,
        client: item.clientName,
        submittedDate: new Date(item.submittedAt).toLocaleDateString(),
        submittedTime: new Date(item.submittedAt).toLocaleTimeString(),
        documents: item.bundle.orderedDocuments.length,
      })),
    [submittedCases]
  );

  const stats: DashboardStat[] = [
    {
      label: "Pending Review",
      value: String(queueCases.length),
      icon: Clock3,
      accentClassName: "bg-amber-500",
    },
    {
      label: "Submitted Cases",
      value: String(queueCases.length),
      icon: FileCheck2,
      accentClassName: "bg-[#01411C]",
    },
    {
      label: "Processed Today",
      value: String(Object.keys(decisionsByCaseId).length),
      icon: CheckCircle2,
      accentClassName: "bg-emerald-600",
    },
    {
      label: "Hearings This Week",
      value: "0",
      icon: CalendarDays,
      accentClassName: "bg-teal-600",
    },
    {
      label: "Returned Cases",
      value: String(returnedCasesCount),
      icon: FileText,
      accentClassName: "bg-red-600",
    },
  ];

  const quickActions: QuickActionItem[] = [
    {
      label: "View Cases",
      icon: Eye,
      className: "bg-[#01411C] hover:bg-[#025a27]",
      to: "/view-cases",
    },
    {
      label: "Review Queue",
      icon: FileText,
      className: "bg-emerald-700 hover:bg-emerald-800",
      to: "/view-cases",
    },
    {
      label: "Approved Cases",
      icon: CheckCircle2,
      className: "bg-[#01411C] hover:bg-[#025a27]",
      to: "/approved-cases",
    },
    {
      label: "Return Cases",
      icon: FileCheck2,
      className: "bg-emerald-700 hover:bg-emerald-800",
      to: "/return-case",
    },
    {
      label: "Schedule Hearing",
      icon: CalendarDays,
      className: "bg-[#01411C] hover:bg-[#025a27]",
      to: "/view-cases",
    },
  ];

  const filteredCases = queueCases.filter((item) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !normalizedQuery ||
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.lawyer.toLowerCase().includes(normalizedQuery) ||
      item.client.toLowerCase().includes(normalizedQuery);
    const matchesType =
      filterType === "all" || item.caseType.toLowerCase() === filterType.toLowerCase();
    return matchesSearch && matchesType;
  });

  return (
    <RegistrarLayout pageSubtitle="Registrar Dashboard" notificationBadge={queueCases.length}>
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Welcome back, {displayName}
          </h2>
          <p className="text-sm text-gray-600">
            Review submitted case bundles and process registrar actions.
          </p>
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {new Date().toLocaleDateString()}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="mt-6">
        <QuickActions actions={quickActions} onNavigate={(to) => navigate({ to })} />
      </section>

      <section className="mt-6">
        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-3 text-sm outline-none focus:border-[#01411C] focus:ring-2 focus:ring-emerald-100"
                placeholder="Search by case title, lawyer, or client..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <select
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#01411C] focus:ring-2 focus:ring-emerald-100"
              value={filterType}
              onChange={(event) => setFilterType(event.target.value)}
            >
              <option value="all">All Case Types</option>
              <option value="civil">Civil</option>
              <option value="family">Family</option>
            </select>
          </div>
        </Card>
      </section>

      <section className="mt-6">
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-emerald-50">
                <tr>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    Case
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    Parties
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    Submission
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCases.map((item) => (
                  <tr key={item.caseId} className="bg-white hover:bg-emerald-50/40">
                    <td className="px-5 py-4">
                      <p className="text-base font-semibold text-gray-900">{item.title}</p>
                      <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {item.caseType}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <p className="font-medium text-gray-900">{item.lawyer}</p>
                      <p className="text-gray-500">Lawyer</p>
                      <p className="mt-2 font-medium text-gray-900">{item.client}</p>
                      <p className="text-gray-500">Client</p>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <p className="font-medium text-gray-900">{item.submittedDate}</p>
                      <p className="text-gray-500">{item.submittedTime}</p>
                      <p className="mt-2 text-xs text-gray-500">
                        {item.documents} files in bundle
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() =>
                          navigate({
                            to: "/review-cases/$caseId",
                            params: { caseId: item.caseId },
                          })
                        }
                        className="inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#025a27]"
                      >
                        <Eye className="h-4 w-4" />
                        Review Case
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCases.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">
                      No submitted cases available in registrar queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </RegistrarLayout>
  );
}
