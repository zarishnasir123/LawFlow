import { CheckCircle } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import RegistrarLayout from "../components/RegistrarLayout";
import Card from "../../../shared/components/dashboard/Card";

export default function ApprovedCases() {
  const navigate = useNavigate();
  return (
    <RegistrarLayout pageSubtitle="Approved Cases">
      <div className="mx-auto max-w-md">
        <Card className="border border-emerald-100 p-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle className="h-12 w-12" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-gray-800">Case Approved</h2>
          <p className="mb-8 text-gray-500">
            The case has been approved and moved to hearing scheduling.
          </p>
          <button
            onClick={() => navigate({ to: "/registrar-dashboard" })}
            className="w-full rounded-lg bg-[#01411C] py-3 font-semibold text-white transition-colors hover:bg-[#013014]"
          >
            Back to Dashboard
          </button>
        </Card>
      </div>
    </RegistrarLayout>
  );
}
