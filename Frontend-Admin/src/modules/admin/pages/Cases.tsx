import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Search,
} from "lucide-react";

import {
  fetchAdminCases,
  type AdminCaseStatus,
} from "../api/adminCases";
import { extractApiErrorMessage } from "../../../shared/api/extractApiErrorMessage";

const PAGE_SIZE = 20;

// The segmented status filter. "all" is a UI-only sentinel — it maps to an
// omitted `status` query param so the backend returns every status.
type StatusFilter = "all" | AdminCaseStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "returned", label: "Returned" },
  { value: "accepted", label: "Accepted" },
];

const statusBadgeClasses: Record<AdminCaseStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-amber-100 text-amber-700",
  returned: "bg-rose-100 text-rose-700",
  accepted: "bg-green-100 text-green-700",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "—";
  return `Rs ${value.toLocaleString()}`;
}

export default function Cases() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [offset, setOffset] = useState(0);

  const trimmedSearch = search.trim();

  const casesQuery = useQuery({
    queryKey: ["admin", "cases", { search: trimmedSearch, status, offset }],
    queryFn: () =>
      fetchAdminCases({
        search: trimmedSearch || undefined,
        status: status === "all" ? undefined : status,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: keepPreviousData,
  });

  const items = casesQuery.data?.items ?? [];
  const total = casesQuery.data?.pagination.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  // Search and filter changes must reset paging — otherwise a page-3 offset
  // can land past the end of a freshly-filtered result set and show nothing.
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setOffset(0);
  };

  const handleStatusChange = (value: StatusFilter) => {
    setStatus(value);
    setOffset(0);
  };

  return (
    <div className="w-full px-6 lg:px-8 xl:px-10 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Hero / Intro */}
        <section className="rounded-2xl border border-green-100 bg-gradient-to-br from-white via-white to-green-50/40 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#01411C] text-white">
                <GitBranch className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#01411C]">
                  Case Tracking
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-gray-600">
                  Read-only audit trail across every case. Track each case from
                  draft through submission, registrar review, and signing, with
                  a payment-readiness snapshot for future payouts.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800">
              {casesQuery.isLoading
                ? "Loading…"
                : `${total} ${total === 1 ? "case" : "cases"}`}
            </div>
          </div>
        </section>

        {/* Status segmented filter */}
        <section className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((filter) => {
            const active = status === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => handleStatusChange(filter.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "bg-[#01411C] text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </section>

        {/* Search */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <label htmlFor="caseSearch" className="sr-only">
            Search cases
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="caseSearch"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by case title, client name, or lawyer name"
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
          </div>
        </section>

        {casesQuery.isError ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {extractApiErrorMessage(casesQuery.error, "Could not load cases.")}
            </span>
          </div>
        ) : null}

        {/* Table */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {casesQuery.isLoading ? (
            <div className="p-10 text-center text-sm text-gray-600">
              Loading cases…
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-600">
              No cases match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Case</th>
                    <th className="px-5 py-3">Lawyer / Client</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Payment Readiness</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="transition hover:bg-green-50/40"
                    >
                      <td className="px-5 py-3 align-top">
                        <Link
                          to="/cases/$caseId"
                          params={{ caseId: item.id }}
                          className="font-semibold text-[#01411C] hover:underline"
                        >
                          {item.title}
                        </Link>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {item.caseType}
                          {item.category ? ` · ${item.category}` : ""}
                        </div>
                      </td>
                      <td className="px-5 py-3 align-top">
                        <div className="text-gray-900">{item.lawyerName}</div>
                        {item.lawyerEmail ? (
                          <div className="text-xs text-gray-500">
                            {item.lawyerEmail}
                          </div>
                        ) : null}
                        <div className="mt-1.5 text-gray-700">
                          Client: {item.clientName}
                        </div>
                        {item.clientEmail ? (
                          <div className="text-xs text-gray-500">
                            {item.clientEmail}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadgeClasses[item.status]}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 align-top">
                        {item.hasAgreement ? (
                          <div className="text-gray-900">
                            {formatMoney(item.agreedFee)}
                            <div className="text-xs text-gray-500">
                              Paid {formatMoney(item.paidAmount)}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                            No agreement
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 align-top text-gray-600">
                        {formatDate(item.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Pagination */}
        {total > 0 ? (
          <section className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-gray-500">
              Showing {pageStart}–{pageEnd} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
