import { useQuery } from "@tanstack/react-query";

import Card from "../../../../shared/components/dashboard/Card";
import StatusBadge from "../../../../shared/components/dashboard/StatusBadge";
import { formatDate } from "../../../../shared/utils/formatDate";
import { listMyCases, type ClientCase, type ClientCaseStatus } from "../../api/cases.api";

type ClientRecentCasesProps = {
  onViewAll: () => void;
  onSelectCase: (caseItem: ClientCase) => void;
};

// Map the client-facing case status to its dashboard label + badge colour.
const STATUS_BADGE: Record<ClientCaseStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-500" },
  submitted: { label: "In Review", className: "bg-blue-500" },
  returned: { label: "Returned", className: "bg-rose-500" },
  accepted: { label: "Accepted / Filed", className: "bg-green-600" },
  disposed: { label: "Disposed", className: "bg-purple-600" },
};

// Most recent meaningful timestamp for the case (decision > submission > created).
function lastUpdated(c: ClientCase): string {
  return c.reviewedAt || c.submittedAt || c.createdAt;
}

function CaseMiniCard({
  item,
  onClick,
}: {
  item: ClientCase;
  onClick: () => void;
}) {
  const badge = STATUS_BADGE[item.status] ?? { label: item.status, className: "bg-gray-500" };

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
        <p className="min-w-0 truncate text-sm font-medium text-gray-900">{item.title}</p>
        <StatusBadge label={badge.label} className={badge.className} />
      </div>
      <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3">
        <div className="min-w-0">
          <p className="mb-1 text-xs text-gray-500">Lawyer</p>
          <p className="truncate text-sm font-medium text-gray-900">
            {item.lawyerName ?? "—"}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs text-gray-500">Last updated</p>
          <p className="text-sm font-medium text-gray-900">
            {formatDate(lastUpdated(item), "date")}
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
        <div key={row} className="rounded-lg border border-gray-200 p-4">
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

// "My Cases" panel — the 2 most recent real cases linked to the signed-in
// client (GET /clients/cases, already newest-first server-side). Loading
// skeleton + empty state; on error we render the empty state so the dashboard
// never blanks out.
export default function ClientRecentCases({
  onViewAll,
  onSelectCase,
}: ClientRecentCasesProps) {
  const { data: cases, isLoading, isError } = useQuery({
    queryKey: ["client", "cases"],
    queryFn: listMyCases,
  });

  const recent = (!isError && cases ? cases : []).slice(0, 2);

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
