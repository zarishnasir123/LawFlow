import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  CalendarDays,
  CreditCard,
  Loader2,
  Search,
} from "lucide-react";

import ClientLayout from "../components/ClientLayout";
import { listMyCases, type ClientCaseStatus } from "../api/cases.api";

// Map the raw backend status (draft|submitted|returned|accepted) to a
// client-friendly label + badge colour. The client only ever sees this
// high-level lifecycle wording — never the registrar's internal review trail.
const STATUS_META: Record<
  ClientCaseStatus,
  { label: string; badgeClass: string }
> = {
  draft: { label: "Being prepared", badgeClass: "bg-gray-100 text-gray-700" },
  submitted: {
    label: "Submitted for review",
    badgeClass: "bg-blue-100 text-blue-700",
  },
  returned: {
    label: "Sent back to your lawyer for corrections",
    badgeClass: "bg-amber-100 text-amber-700",
  },
  accepted: {
    label: "Accepted / Filed",
    badgeClass: "bg-emerald-100 text-emerald-700",
  },
};

function getStatusMeta(status: ClientCaseStatus) {
  return STATUS_META[status] ?? STATUS_META.draft;
}

// Render an ISO timestamp as a human date, or a dash when the backend hasn't
// reached that lifecycle step yet (e.g. a draft has no submittedAt).
function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const STATUS_FILTERS: Array<"all" | ClientCaseStatus> = [
  "all",
  "draft",
  "submitted",
  "returned",
  "accepted",
];

export default function ClientMyCases() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ClientCaseStatus>("all");

  const {
    data: cases,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["client", "cases"],
    queryFn: listMyCases,
  });

  const filteredCases = useMemo(() => {
    const items = cases ?? [];
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesSearch =
        q.length === 0 ||
        item.title.toLowerCase().includes(q) ||
        (item.lawyerName ?? "").toLowerCase().includes(q) ||
        (item.caseTypeLabel ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [cases, search, statusFilter]);

  return (
    <ClientLayout
      brandSubtitle="My Cases"
      showBackButton
      onBackClick={() => navigate({ to: "/client-dashboard" })}
    >
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          My <span className="text-[var(--primary)]">Cases</span>
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-gray-600">
          Every case your lawyer has filed for you, with its current status.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-lg">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by case title, type, or lawyer"
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-600"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === status
                      ? "bg-[#01411C] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {status === "all" ? "All" : getStatusMeta(status).label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white p-10 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin text-[#01411C]" />
              Loading your cases…
            </div>
          )}

          {isError && !isLoading && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
              <p className="font-semibold">We couldn't load your cases.</p>
              <p className="mt-1 text-red-600">
                Please check your connection and try again.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23] disabled:opacity-60"
              >
                {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
                Retry
              </button>
            </div>
          )}

          {!isLoading && !isError && filteredCases.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
              {(cases ?? []).length === 0
                ? "You don't have any cases yet. When your lawyer files a case for you, it will appear here."
                : "No cases match your current filter."}
            </div>
          )}

          {!isLoading &&
            !isError &&
            filteredCases.map((item) => {
              const statusMeta = getStatusMeta(item.status);
              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 border-b border-gray-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                        Case Overview
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold tracking-tight text-gray-900">
                          {item.title}
                        </h2>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </span>
                        {item.caseTypeLabel && (
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                            {item.caseTypeLabel}
                          </span>
                        )}
                      </div>
                      {item.category && (
                        <p className="max-w-3xl text-sm capitalize leading-6 text-gray-600">
                          {item.category} matter
                        </p>
                      )}
                    </div>

                    <div className="grid w-full gap-2 rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-sm lg:w-72">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Filed On</span>
                        <span className="font-medium text-gray-800">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Submitted</span>
                        <span className="font-medium text-gray-800">
                          {formatDate(item.submittedAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Last Reviewed</span>
                        <span className="font-medium text-gray-800">
                          {formatDate(item.reviewedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50/70 to-white p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <BriefcaseBusiness className="h-4 w-4 text-[#01411C]" />
                        Assigned Lawyer
                      </div>
                      <p className="text-base font-semibold text-gray-900">
                        {item.lawyerName ?? "To be assigned"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-sm font-medium text-emerald-900">
                    <p className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-emerald-700" />
                      Status: {statusMeta.label}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => navigate({ to: `/client-payments/${item.id}` })}
                      className="inline-flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100"
                    >
                      <CreditCard className="h-4 w-4" />
                      View Payments
                    </button>
                  </div>
                </article>
              );
            })}
        </section>
      </div>
    </ClientLayout>
  );
}
