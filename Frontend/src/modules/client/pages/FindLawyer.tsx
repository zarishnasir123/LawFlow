import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import ClientLayout from "../components/ClientLayout";
import LawyerCard from "../components/LawyerCard";
import { fetchLawyers, type ListLawyersParams } from "../api/lawyers";

// Specialization filter values match the backend's closed-set
// validator (Civil / Family). "all" disables the filter.
type SpecializationFilter = "all" | "Civil" | "Family";

// Page size for the Load-more flow. 20 keeps the backend roundtrip
// quick and the visible scroll height reasonable; the backend caps
// at 100 if we ever want larger pages.
const PAGE_SIZE = 20;

export default function FindLawyer() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SpecializationFilter>("all");
  const navigate = useNavigate();

  // useInfiniteQuery owns the page-stitching: it caches each page
  // under the same queryKey and exposes fetchNextPage / hasNextPage
  // so the Load-more button stays one line of UI. When the search
  // or category changes the queryKey changes, which automatically
  // resets the pagination — no manual cleanup needed.
  const params: ListLawyersParams = {
    search: query.trim() || undefined,
    specialization: category,
  };
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ["lawyers", "directory", params],
    queryFn: ({ pageParam = 0 }) =>
      fetchLawyers({ ...params, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    // Next offset = number of items already loaded. Undefined when
    // we've hit the end, which is how TanStack disables fetchNextPage.
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < lastPage.pagination.total ? loaded : undefined;
    },
  });

  // Flatten all pages into one continuous list for rendering. The
  // total is the same on every page; reading from page[0] is fine.
  const lawyers = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.pagination.total ?? 0;
  const shown = lawyers.length;

  return (
    <ClientLayout brandSubtitle="Find a Lawyer">
      <div className="mb-4 rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50/70 px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Find the right expert
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              Browse verified lawyers by specialty
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Compare experience, success rate, and fees to choose the best fit.
            </p>
          </div>
          <div className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
            {total} result{total === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.6fr_0.9fr]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
            Search
            <div className="relative mt-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or specialization..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50/60 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SpecializationFilter)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50/60 py-2.5 px-3 text-sm text-gray-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            >
              <option value="all">All Categories</option>
              <option value="Family">Family Law</option>
              <option value="Civil">Civil Law</option>
            </select>
          </label>
        </div>
      </div>

      {/* Loading / error / empty / results */}
      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Loading lawyers…
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">
          {(error as Error)?.message || "Failed to load lawyers. Please try again."}
        </div>
      ) : (
        <>
          {/* Multi-column grid. 1 column on mobile, 2 on tablet+,
              3 on very wide desktops. Each card is self-contained
              (vertical layout) so widths flex without breaking the
              internal hierarchy. */}
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {lawyers.map((lawyer) => (
              <LawyerCard
                key={lawyer.lawyerProfileId}
                lawyer={lawyer}
                onViewProfile={(id) => navigate({ to: `/client-lawyer/${id}` })}
                onMessage={() => navigate({ to: "/client-messages" })}
              />
            ))}

            {lawyers.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                No lawyers found matching your criteria.
              </div>
            )}
          </div>

          {/* Pagination footer — only renders when there's at least
              one result. Shows the count even when all pages are
              already loaded so the user knows they've seen
              everything. */}
          {lawyers.length > 0 && (
            <div className="mt-6 flex flex-col items-center gap-3">
              {hasNextPage ? (
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#01411C] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#024a23] disabled:cursor-wait disabled:opacity-60"
                >
                  {isFetchingNextPage ? "Loading…" : `Load ${Math.min(PAGE_SIZE, total - shown)} more`}
                </button>
              ) : null}
              <p className="text-xs text-gray-500">
                Showing <span className="font-semibold text-gray-700">{shown}</span> of{" "}
                <span className="font-semibold text-gray-700">{total}</span> lawyer
                {total === 1 ? "" : "s"}
                {hasNextPage ? "" : " · all loaded"}
              </p>
            </div>
          )}
        </>
      )}
    </ClientLayout>
  );
}
