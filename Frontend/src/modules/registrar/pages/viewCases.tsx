import { Eye } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import RegistrarLayout from "../components/RegistrarLayout";
import Card from "../../../shared/components/dashboard/Card";
import { useCaseFilingStore } from "../../lawyer/store/caseFiling.store";
import { getCaseDisplayTitle } from "../../../shared/utils/caseDisplay";
import {
  getFcfsSubmissionQueue,
  getProcessedCaseIdsForLatestSubmission,
} from "../utils/submissionQueue";
import { useRegistrarReviewDecisionStore } from "../store/reviewDecisions.store";

export function ViewCases() {
  const navigate = useNavigate();
  const liveSubmittedCases = useCaseFilingStore((state) =>
    state.getSubmittedCasesForRegistrar()
  );
  const decisionsByCaseId = useRegistrarReviewDecisionStore(
    (state) => state.decisionsByCaseId
  );
  const queue = useMemo(
    () => getFcfsSubmissionQueue(liveSubmittedCases),
    [liveSubmittedCases]
  );
  const excludedCaseIds = useMemo(
    () => getProcessedCaseIdsForLatestSubmission(queue, decisionsByCaseId),
    [queue, decisionsByCaseId]
  );
  const submittedCases = useMemo(
    () => queue.filter((item) => !excludedCaseIds.has(item.caseId)),
    [queue, excludedCaseIds]
  );

  return (
    <RegistrarLayout pageSubtitle="View Submitted Cases" notificationBadge={submittedCases.length}>
      <Card className="overflow-hidden p-0">
        <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-4">
          <h3 className="text-base font-semibold text-emerald-900">Registrar Queue</h3>
          <p className="mt-1 text-sm text-emerald-700">
            Review newly submitted case files from lawyers.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-white">
              <tr>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Queue
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Case
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Client
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Lawyer
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Submitted
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submittedCases.map((caseItem, index) => (
                <tr key={caseItem.caseId} className="hover:bg-emerald-50/40">
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      #{index + 1}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-900">
                      {getCaseDisplayTitle(caseItem.title, caseItem.caseId)}
                    </p>
                    <p className="text-xs capitalize text-gray-500">{caseItem.caseType} case</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">{caseItem.clientName}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">{caseItem.submittedBy}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {new Date(caseItem.submittedAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      Pending Review
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() =>
                        navigate({
                          to: "/review-cases/$caseId",
                          params: { caseId: caseItem.caseId },
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Eye className="h-4 w-4" />
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {submittedCases.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">
              No submitted cases available yet.
            </p>
          )}
        </div>
      </Card>
    </RegistrarLayout>
  );
}
