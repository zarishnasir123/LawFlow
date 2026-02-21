import { Calendar, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import RegistrarLayout from "../components/RegistrarLayout";
import Card from "../../../shared/components/dashboard/Card";
import { useCaseFilingStore } from "../../lawyer/store/caseFiling.store";
import { getFcfsSubmissionQueue } from "../utils/submissionQueue";
import { getCaseDisplayTitle } from "../../../shared/utils/caseDisplay";

export default function ScheduleHearing() {
  const navigate = useNavigate();
  const { caseId } = useParams({ from: "/schedule-hearing/$caseId" });
  const [scheduled, setScheduled] = useState(false);

  const liveSubmittedCases = useCaseFilingStore((state) =>
    state.getSubmittedCasesForRegistrar()
  );
  const submittedCases = getFcfsSubmissionQueue(liveSubmittedCases);
  const caseData = submittedCases.find((item) => item.caseId === caseId);
  const caseTitle = getCaseDisplayTitle(caseData?.title, caseData?.caseId);

  if (scheduled) {
    return (
      <RegistrarLayout pageSubtitle="Schedule Hearing" notificationBadge={submittedCases.length}>
        <div className="mx-auto max-w-md">
          <Card className="border-t-4 border-[#01411C] p-8 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="mb-4 text-2xl font-bold text-[#01411C]">Hearing Scheduled</h2>
            <p className="mb-6 text-gray-600">
              The hearing for <b>{caseTitle}</b> has been scheduled successfully.
            </p>
            <button
              onClick={() => navigate({ to: "/registrar-dashboard" })}
              className="w-full rounded-lg bg-[#01411C] py-3 font-semibold text-white transition-colors hover:bg-[#024a23]"
            >
              Back to Dashboard
            </button>
          </Card>
        </div>
      </RegistrarLayout>
    );
  }

  return (
    <RegistrarLayout pageSubtitle="Schedule Hearing" notificationBadge={submittedCases.length}>
      <div className="mx-auto max-w-2xl">
        <Card className="p-8">
          <h3 className="mb-2 text-xl font-bold text-[#01411C]">Hearing Details</h3>
          <p className="mb-6 text-sm text-gray-600">Case: {caseTitle}</p>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Hearing Date</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-gray-300 p-2 outline-none focus:ring-1 focus:ring-[#01411C]"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Hearing Time</label>
                <input
                  type="time"
                  className="w-full rounded-md border border-gray-300 p-2 outline-none focus:ring-1 focus:ring-[#01411C]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Court Room</label>
              <select className="w-full rounded-md border border-gray-300 bg-white p-2 outline-none focus:ring-1 focus:ring-[#01411C]">
                <option value="">Select court room</option>
                <option value="room1">Court Room 1</option>
                <option value="room2">Court Room 2</option>
                <option value="room3">Court Room 3</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Presiding Judge</label>
              <select className="w-full rounded-md border border-gray-300 bg-white p-2 outline-none focus:ring-1 focus:ring-[#01411C]">
                <option value="">Select judge</option>
                <option value="judge1">Hon. Justice Muhammad Iqbal</option>
                <option value="judge2">Hon. Justice Ayesha Malik</option>
              </select>
            </div>

            <div className="space-y-2 pb-2">
              <label className="block text-sm font-medium text-gray-700">Hearing Type</label>
              <select className="w-full rounded-md border border-gray-300 bg-white p-2 outline-none focus:ring-1 focus:ring-[#01411C]">
                <option value="first">First Hearing</option>
                <option value="final">Final Hearing</option>
              </select>
            </div>

            <button
              onClick={() => setScheduled(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#01411C] py-4 font-bold text-white shadow-md transition-all hover:bg-[#024a23]"
            >
              <Calendar className="h-5 w-5" />
              Confirm & Schedule Hearing
            </button>
          </div>
        </Card>
      </div>
    </RegistrarLayout>
  );
}
