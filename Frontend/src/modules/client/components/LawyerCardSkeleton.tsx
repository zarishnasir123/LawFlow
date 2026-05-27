// Placeholder card rendered while the next page of lawyers is in
// flight. Mirrors the real LawyerCard's layout so the grid expands
// smoothly rather than popping new cards into existence.
export default function LawyerCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Accent stripe placeholder */}
      <div className="h-1 w-full animate-pulse bg-gray-100" />

      <div className="flex flex-col gap-4 p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 animate-pulse rounded-xl bg-gray-100" />
            <div>
              <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
              <div className="mt-1.5 h-3 w-24 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
          <div>
            <div className="ml-auto h-2.5 w-10 animate-pulse rounded bg-gray-100" />
            <div className="mt-1 h-4 w-20 animate-pulse rounded bg-gray-100" />
          </div>
        </div>

        {/* KPI strip */}
        <div className="flex gap-4">
          <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
        </div>

        {/* Bio block */}
        <div className="space-y-1.5 rounded-lg bg-gray-50 px-3 py-2">
          <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-gray-100" />
        </div>

        {/* Footer actions */}
        <div className="mt-auto flex items-center gap-2 pt-2">
          <div className="h-8 w-24 animate-pulse rounded-lg bg-gray-100" />
          <div className="ml-auto h-8 w-32 animate-pulse rounded-lg bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
