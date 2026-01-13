import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export default function LawyerCases() {
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

        <h1 className="text-xl font-semibold">My Cases</h1>
      </div>

      <div className="rounded-lg border bg-white p-6 text-gray-700">
        <p className="text-sm">
          This page will show all lawyer cases.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          (API integration will come here later)
        </p>
      </div>
    </div>
  );
}
