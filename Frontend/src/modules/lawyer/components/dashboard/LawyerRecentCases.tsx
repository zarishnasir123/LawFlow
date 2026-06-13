import { useQuery } from "@tanstack/react-query";

import Card from "../../../../shared/components/dashboard/Card";
import StatusBadge from "../../../../shared/components/dashboard/StatusBadge";
import { formatDate } from "../../../../shared/utils/formatDate";
import { casesApi, type ApiCase, type CaseStatus } from "../../api/cases.api";

type LawyerRecentCasesProps = {
  onViewAll: () => void;
  onSelectCase: (caseItem: ApiCase) => void;
};

// Map the real cases.status to its dashboard label + badge colour.
//   draft     -> "Draft"     (gray)
//   submitted -> "Submitted" (blue)
//   returned  -> "Returned"  (rose)
//   accepted  -> "Accepted"  (green)
const STATUS_BADGE: Record<CaseStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-500" },
  submitted: { label: "Submitted", className: "bg-blue-500" },
  returned: { label: "Returned", className: "bg-rose-500" },
  accepted: { label: "Accepted", className: "bg-green-600" },
};

// One mini case card. Keeps the shared CaseCard's visual layout (border, hover
// shadow, two-column footer) but renders REAL fields: the case title, a real
// status badge, the client name labelled "Client" (the lawyer is the viewer),
// and the last-edited date labelled "Last edited" (hearings aren't built).
function CaseMiniCard({
  item,
  onClick,
}: {
  item: ApiCase;
  onClick: () => void;
}) {
  const badge = STATUS_BADGE[item.status];

  return (
    <div
      className="cursor-pointer rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-gray-900">
          {item.title}
        </p>
        <StatusBadge label={badge.label} className={badge.className} />
      </div>
      <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3">
        <div className="min-w-0">
          <p className="mb-1 text-xs text-gray-500">Client</p>
          <p className="truncate text-sm font-medium text-gray-900">
            {item.clientName}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs text-gray-500">Last edited</p>
          <p className="text-sm font-medium text-gray-900">
            {formatDate(item.updatedAt, "date")}
          </p>
        </div>
      </div>
    </div>
  );
}

function CasesSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1].map((row) => (
        <div
          key={row}
          className="rounded-lg border border-gray-200 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-16 animate-pulse rounded-full bg-gray-100" />
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3">
            <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

// PANEL 1: My Cases — the 2 most recent real cases for the logged-in lawyer.
// Reuses casesApi.listMyCases (already sorted updated_at DESC server-side) and
// slices the top 2. Loading skeleton + empty state. "View All" navigates to the
// lawyer cases list route.
export default function LawyerRecentCases({
  onViewAll,
  onSelectCase,
}: LawyerRecentCasesProps) {
  const {
    data: cases,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["lawyer", "cases"],
    queryFn: casesApi.listMyCases,
  });

  // Server already orders by updated_at DESC; defensively re-sort, then take 2.
  const recent = (!isError && cases ? cases : [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, 2);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#01411C]">My Cases</h3>
        <button
          type="button"
          onClick={onViewAll}
          className="rounded-lg border border-[#01411C] px-3 py-1 text-xs font-semibold text-[#01411C] transition hover:bg-green-50"
        >
          View All
        </button>
      </div>

      {isLoading ? (
        <CasesSkeleton />
      ) : recent.length === 0 ? (
        <p className="py-4 text-sm text-gray-500">No cases yet.</p>
      ) : (
        <div className="space-y-4">
          {recent.map((caseItem) => (
            <CaseMiniCard
              key={caseItem.id}
              item={caseItem}
              onClick={() => onSelectCase(caseItem)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
