import { FileText, MessageCircle } from "lucide-react";
import type { ActivityItem } from "../../types/dashboard";
import Card from "./Card";

type RecentActivityProps = {
  items: ActivityItem[];
};

export default function RecentActivity({ items }: RecentActivityProps) {
  return (
    <Card>
      <h3 className="mb-3 text-base font-semibold text-[#01411C]">Recent Activity</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <div
              className={[
                "rounded p-1.5",
                item.type === "message" ? "bg-green-100" : "bg-blue-100",
              ].join(" ")}
            >
              {item.type === "message" ? (
                <MessageCircle className="h-3 w-3 text-green-600" />
              ) : (
                <FileText className="h-3 w-3 text-blue-600" />
              )}
            </div>
            <div>
              <p className="text-xs text-gray-600">{item.label}</p>
              <p className="text-xs text-gray-400">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
