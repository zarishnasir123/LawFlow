import type { MouseEvent } from "react";
import type { CaseItem } from "../../types/dashboard";
import StatusBadge from "./StatusBadge";

type CaseCardProps = {
  item: CaseItem;
  statusClassName: string;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
};

export default function CaseCard({ item, statusClassName, onClick }: CaseCardProps) {
  return (
    <div
      className="cursor-pointer rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.(event as unknown as MouseEvent<HTMLDivElement>);
        }
      }}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h4 className="text-gray-900">{item.caseNumber}</h4>
            <StatusBadge label={item.status} className={statusClassName} />
          </div>
          <p className="text-sm text-gray-600">{item.title}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3">
        <div>
          <p className="mb-1 text-xs text-gray-500">Lawyer</p>
          <p className="text-sm font-medium text-gray-900">{item.lawyer}</p>
        </div>
        <div>
          <p className="mb-1 text-xs text-gray-500">Next Hearing</p>
          <p className="text-sm font-medium text-gray-900">{item.nextHearing}</p>
        </div>
      </div>
    </div>
  );
}
