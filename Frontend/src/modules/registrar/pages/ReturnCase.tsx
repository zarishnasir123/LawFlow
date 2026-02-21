import { Eye, RotateCcw, XCircle } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import RegistrarLayout from "../components/RegistrarLayout";
import Card from "../../../shared/components/dashboard/Card";
import { useRegistrarReviewDecisionStore } from "../store/reviewDecisions.store";

export default function ReturnCase() {
  const navigate = useNavigate();
  const returnedCases = useRegistrarReviewDecisionStore((state) => state.returnedCases);
  const sortedReturnedCases = useMemo(
    () =>
      [...returnedCases].sort(
        (a, b) =>
          new Date(b.returnedAt).getTime() - new Date(a.returnedAt).getTime()
      ),
    [returnedCases]
  );

  return (
    <RegistrarLayout
      pageSubtitle="Returned Cases"
      notificationBadge={sortedReturnedCases.length}
    >
      <Card className="overflow-hidden p-0">
        <div className="border-b border-red-100 bg-red-50 px-5 py-4">
          <h3 className="text-base font-semibold text-red-900">Returned Cases</h3>
          <p className="mt-1 text-sm text-red-700">
            Cases returned by registrar for lawyer corrections.
          </p>
        </div>

        {sortedReturnedCases.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
              <XCircle className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">No returned cases yet</h2>
            <p className="mt-1 text-sm text-gray-500">
              Returned cases will appear here after registrar sends correction remarks.
            </p>
            <button
              onClick={() => navigate({ to: "/view-cases" })}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#025a27]"
            >
              <Eye className="h-4 w-4" />
              Open Review Queue
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="bg-white">
                <tr>
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
                    Returned At
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Remarks
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedReturnedCases.map((caseItem) => (
                  <tr key={caseItem.caseId} className="hover:bg-red-50/30">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{caseItem.title}</p>
                      <p className="text-xs capitalize text-gray-500">{caseItem.caseType} case</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">{caseItem.clientName}</td>
                    <td className="px-5 py-4 text-sm text-gray-700">{caseItem.submittedBy}</td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {new Date(caseItem.returnedAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {caseItem.remarks || "Correction required"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() =>
                          navigate({
                            to: "/review-cases/$caseId",
                            params: { caseId: caseItem.caseId },
                          })
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Re-open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </RegistrarLayout>
  );
}
