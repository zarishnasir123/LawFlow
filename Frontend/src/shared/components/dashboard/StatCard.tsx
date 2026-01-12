import type { DashboardStat } from "../../types/dashboard";
import Card from "./Card";

type StatCardProps = DashboardStat;

export default function StatCard({
  label,
  value,
  icon: Icon,
  accentClassName,
}: StatCardProps) {
  return (
    <Card className="flex items-center justify-between">
      <div className="space-y-2">
        <div className={["inline-flex rounded-xl p-3", accentClassName].join(" ")}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <p className="text-sm text-gray-600">{label}</p>
      </div>
      <span className="text-3xl font-bold text-gray-900">{value}</span>
    </Card>
  );
}
