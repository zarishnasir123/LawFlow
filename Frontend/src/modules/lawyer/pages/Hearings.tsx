import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Calendar } from "lucide-react";

export default function LawyerHearings() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/Lawyer-dashboard" })}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-black"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <h1 className="text-xl font-semibold">Hearings</h1>
      </div>

      <div className="rounded-lg border bg-white p-6 text-gray-700">
        <div className="flex items-center gap-3">
          <Calendar />
          <span>Upcoming hearings will appear here.</span>
        </div>
      </div>
    </div>
  );
}
