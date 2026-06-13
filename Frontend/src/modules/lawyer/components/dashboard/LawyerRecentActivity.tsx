import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  FileSignature,
  RotateCcw,
  Send,
  type LucideIcon,
} from "lucide-react";

import Card from "../../../../shared/components/dashboard/Card";
import { formatDate } from "../../../../shared/utils/formatDate";
import {
  casesApi,
  type LawyerActivityItem,
  type LawyerActivityType,
} from "../../api/cases.api";

// Per-event-type icon + colour. case_submitted / case_accepted read as
// positive (green); case_returned is a "needs attention" rose; client_signed
// is a blue document/signature event. Mirrors the backend `type` values one
// for one so a new event type surfaces here as a typed compile error.
const ACTIVITY_STYLE: Record<
  LawyerActivityType,
  { icon: LucideIcon; iconClassName: string; bgClassName: string }
> = {
  case_submitted: {
    icon: Send,
    iconClassName: "text-green-600",
    bgClassName: "bg-green-100",
  },
  case_accepted: {
    icon: CheckCircle2,
    iconClassName: "text-green-600",
    bgClassName: "bg-green-100",
  },
  case_returned: {
    icon: RotateCcw,
    iconClassName: "text-rose-600",
    bgClassName: "bg-rose-100",
  },
  client_signed: {
    icon: FileSignature,
    iconClassName: "text-blue-600",
    bgClassName: "bg-blue-100",
  },
};

function ActivityRow({ item }: { item: LawyerActivityItem }) {
  const style = ACTIVITY_STYLE[item.type];
  const Icon = style.icon;

  return (
    <div className="flex items-start gap-3">
      <div className={["rounded p-1.5", style.bgClassName].join(" ")}>
        <Icon className={["h-3 w-3", style.iconClassName].join(" ")} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-700">{item.title}</p>
        <p className="truncate text-xs text-gray-500">{item.subject}</p>
        <p className="text-xs text-gray-400">
          {formatDate(item.timestamp, "relative")}
        </p>
      </div>
    </div>
  );
}

// Loading skeleton — three shimmer rows that echo the real row layout so the
// panel keeps its height while the feed loads.
function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-start gap-3">
          <div className="h-6 w-6 animate-pulse rounded bg-gray-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-3/4 animate-pulse rounded bg-gray-100" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

// PANEL 2: Recent Activity — real lawyer feed. Loads the ~6 most recent events
// (submissions, accept/return decisions, client signatures) for the logged-in
// lawyer via casesApi.getRecentActivity. Loading skeleton + empty state, and on
// error we render the empty state too so the dashboard never blanks out.
export default function LawyerRecentActivity() {
  const {
    data: activities,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["lawyer", "recent-activity"],
    queryFn: casesApi.getRecentActivity,
  });

  const items = !isError && activities ? activities : [];

  return (
    <Card>
      <h3 className="mb-3 text-base font-semibold text-[#01411C]">
        Recent Activity
      </h3>

      {isLoading ? (
        <ActivitySkeleton />
      ) : items.length === 0 ? (
        <p className="py-4 text-xs text-gray-500">No recent activity.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </Card>
  );
}
