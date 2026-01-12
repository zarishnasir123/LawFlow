import { Calendar } from "lucide-react";
import type { HearingItem } from "../../types/dashboard";
import Card from "./Card";

type UpcomingHearingsProps = {
  hearings: HearingItem[];
  onNavigate: () => void;
};

export default function UpcomingHearings({ hearings, onNavigate }: UpcomingHearingsProps) {
  return (
    <Card>
      <h3 className="mb-3 text-base font-semibold text-[#01411C]">Upcoming Hearings</h3>
      <div className="space-y-3">
        {hearings.map((hearing) => (
          <button
            key={hearing.id}
            type="button"
            onClick={onNavigate}
            className="w-full rounded-lg border border-purple-200 bg-purple-50 p-4 text-left transition-shadow hover:shadow-md"
          >
            <div className="mb-2 flex items-center gap-2 text-purple-700">
              <Calendar className="h-4 w-4" />
              <p className="text-sm font-medium">{hearing.caseNumber}</p>
            </div>
            <p className="text-xs text-purple-700">{hearing.title}</p>
            <p className="text-xs text-purple-600">{hearing.dateTime}</p>
          </button>
        ))}
      </div>
    </Card>
  );
}
