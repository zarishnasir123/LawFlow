import type { CaseItem } from "../../types/dashboard";
import Card from "./Card";
import CaseCard from "./CaseCard";

type RecentCasesProps = {
  cases: CaseItem[];
  onViewAll: () => void;
  onSelectCase: (caseItem: CaseItem) => void;
};

export default function RecentCases({ cases, onViewAll, onSelectCase }: RecentCasesProps) {
  const statusClassName = (status: string) => {
    switch (status) {
      case "Hearing Scheduled":
        return "bg-purple-500";
      case "In Review":
        return "bg-blue-500";
      case "Approved":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

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
      <div className="space-y-4">
        {cases.map((caseItem) => (
          <CaseCard
            key={caseItem.id}
            item={caseItem}
            statusClassName={statusClassName(caseItem.status)}
            onClick={() => onSelectCase(caseItem)}
          />
        ))}
      </div>
    </Card>
  );
}
