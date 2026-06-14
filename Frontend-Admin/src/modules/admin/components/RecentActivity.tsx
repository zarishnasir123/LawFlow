import {
  Activity,
  BadgeCheck,
  FileCheck2,
  FileX2,
  UserPlus,
  UserX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type {
  ActivityType,
  RecentActivityItem,
} from "../api/recentActivity";
import { formatRelativeTime } from "../../../shared/utils/relativeTime";

// Each activity type renders with its own icon + colour pair. The colours
// follow the existing dashboard palette (green = positive/approved,
// blue = neutral/new, rose = negative/returned/rejected).
type ActivityStyle = {
  icon: LucideIcon;
  iconColor: string;
  bgColor: string;
};

const activityStyles: Record<ActivityType, ActivityStyle> = {
  lawyer_approved: {
    icon: BadgeCheck,
    iconColor: "text-green-600",
    bgColor: "bg-green-100",
  },
  lawyer_rejected: {
    icon: UserX,
    iconColor: "text-rose-600",
    bgColor: "bg-rose-100",
  },
  lawyer_requested: {
    icon: UserPlus,
    iconColor: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  registrar_created: {
    icon: UserPlus,
    iconColor: "text-emerald-600",
    bgColor: "bg-emerald-100",
  },
  case_accepted: {
    icon: FileCheck2,
    iconColor: "text-green-600",
    bgColor: "bg-green-100",
  },
  case_returned: {
    icon: FileX2,
    iconColor: "text-rose-600",
    bgColor: "bg-rose-100",
  },
};

// Fallback for any future/unknown type so the panel never crashes on a value
// the backend adds before the frontend learns about it.
const fallbackStyle: ActivityStyle = {
  icon: Activity,
  iconColor: "text-gray-600",
  bgColor: "bg-gray-100",
};

type Props = {
  items: RecentActivityItem[];
  isLoading?: boolean;
};

export function RecentActivityList({ items, isLoading = false }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="font-semibold text-gray-900 mb-6">Recent Activity</h3>

      {isLoading ? (
        <RecentActivitySkeleton />
      ) : items.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
          No recent activity.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((a) => {
            const style = activityStyles[a.type] ?? fallbackStyle;
            const Icon = style.icon;

            return (
              <div
                key={a.id}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className={`p-2 rounded-full ${style.bgColor}`}>
                  <Icon className={`h-4 w-4 ${style.iconColor}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{a.title}</p>
                  {a.subject ? (
                    <p className="text-xs text-gray-600 truncate" title={a.subject}>
                      {a.subject}
                    </p>
                  ) : null}
                  <p className="text-xs text-gray-500 mt-1">
                    {formatRelativeTime(a.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Subtle shimmer placeholders that keep the panel's row rhythm while loading.
function RecentActivitySkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg animate-pulse"
        >
          <div className="h-8 w-8 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 w-2/3 rounded bg-gray-200" />
            <div className="h-3 w-1/3 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
