import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Calendar,
  CreditCard,
  FileText,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

import Card from "../../../../shared/components/dashboard/Card";
import { formatDate } from "../../../../shared/utils/formatDate";
import { useClientNotifications } from "../../hooks/useClientNotifications";
import type { Notification } from "../../types/notification";

// Per-category icon + colour. Mirrors the notification categories the client
// API already narrows to (case / hearing / message / document / system).
const ACTIVITY_STYLE: Record<
  Notification["type"],
  { icon: LucideIcon; iconClassName: string; bgClassName: string }
> = {
  message: { icon: MessageCircle, iconClassName: "text-green-600", bgClassName: "bg-green-100" },
  hearing: { icon: Calendar, iconClassName: "text-purple-600", bgClassName: "bg-purple-100" },
  case: { icon: FileText, iconClassName: "text-blue-600", bgClassName: "bg-blue-100" },
  document: { icon: FileText, iconClassName: "text-amber-600", bgClassName: "bg-amber-100" },
  payment: { icon: CreditCard, iconClassName: "text-emerald-600", bgClassName: "bg-emerald-100" },
  system: { icon: Bell, iconClassName: "text-gray-600", bgClassName: "bg-gray-100" },
};

function ActivityRow({
  item,
  onClick,
}: {
  item: Notification;
  onClick?: () => void;
}) {
  const style = ACTIVITY_STYLE[item.type] ?? ACTIVITY_STYLE.system;
  const Icon = style.icon;
  const clickable = Boolean(onClick);

  return (
    <div
      className={[
        "flex items-start gap-3 rounded-lg p-1.5",
        clickable ? "cursor-pointer hover:bg-gray-50" : "",
      ].join(" ")}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(event) => {
        if (clickable && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className={["mt-0.5 rounded p-1.5", style.bgClassName].join(" ")}>
        <Icon className={["h-3 w-3", style.iconClassName].join(" ")} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-700">{item.title}</p>
        <p className="truncate text-xs text-gray-500">{item.message}</p>
        <p className="text-xs text-gray-400">{formatDate(item.createdAt, "relative")}</p>
      </div>
    </div>
  );
}

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

// Recent Activity — the 5 most recent real notifications for the signed-in
// client (case updates, hearing events, new messages). Reuses the shared
// notifications hook, which already polls every 30s, so the feed refreshes on
// its own. Capped at 5 with a bounded, scrollable height so it never grows the
// page. Rows with a link are clickable.
export default function ClientRecentActivity() {
  const navigate = useNavigate();
  const { notifications, isLoading, isError } = useClientNotifications();

  const items = (!isError && notifications ? notifications : []).slice(0, 5);

  return (
    <Card>
      <h3 className="mb-3 text-base font-semibold text-[#01411C]">Recent Activity</h3>

      {isLoading ? (
        <ActivitySkeleton />
      ) : items.length === 0 ? (
        <p className="py-4 text-xs text-gray-500">No recent activity.</p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <ActivityRow
              key={item.id}
              item={item}
              onClick={
                item.actionUrl
                  ? () => navigate({ to: item.actionUrl as string })
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </Card>
  );
}
