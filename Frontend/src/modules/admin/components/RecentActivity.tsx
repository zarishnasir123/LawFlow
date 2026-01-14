import { Activity } from "lucide-react";
import type { RecentActivityItem } from "../types";

export function RecentActivityList({ items }: { items: RecentActivityItem[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="font-semibold text-gray-900 mb-6">Recent Activity</h3>

      <div className="space-y-4">
        {items.map((a) => (
          <div key={a.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <div className={`p-2 rounded-full ${a.status === "success" ? "bg-green-100" : "bg-blue-100"}`}>
              <Activity className={`h-4 w-4 ${a.status === "success" ? "text-green-600" : "text-blue-600"}`} />
            </div>

            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{a.action}</p>
              <p className="text-xs text-gray-600">{a.user}</p>
              <p className="text-xs text-gray-500 mt-1">{a.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
