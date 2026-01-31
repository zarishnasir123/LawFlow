import type { DashboardStat } from "../../types/dashboard";
import Card from "./Card";

type StatCardProps = DashboardStat;

export default function StatCard({
  label,
  value,
  icon: Icon,
  accentClassName,
  onClick,
}: StatCardProps) {
  const cardClasses = ["flex items-center justify-between", onClick ? "cursor-pointer" : ""]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <div className="space-y-2">
        <div className={["inline-flex rounded-xl p-3", accentClassName].join(" ")}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <p className="text-sm text-gray-600">{label}</p>
      </div>
      <span className="text-3xl font-bold text-gray-900">{value}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={[
          "rounded-2xl border border-green-100/70 bg-white p-5 shadow-sm",
          cardClasses,
        ].join(" ")}
      >
        {content}
      </button>
    );
  }

  return <Card className={cardClasses}>{content}</Card>;
}
