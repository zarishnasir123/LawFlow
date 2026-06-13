import { Undo2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import RegistrarLayout from "../components/RegistrarLayout";
import Card from "../../../shared/components/dashboard/Card";
import { getCaseDisplayTitle } from "../../../shared/utils/caseDisplay";
import { listCases } from "../api";

export default function ReturnedCasesList() {
  const {
    data: returnedCases = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["registrar", "cases", "returned"],
    queryFn: () => listCases("returned"),
  });

  return (
    <RegistrarLayout pageSubtitle="Returned Cases">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-rose-100 bg-rose-50 px-5 py-4">
          <h3 className="inline-flex items-center gap-2 text-base font-semibold text-rose-900">
            <Undo2 className="h-5 w-5 text-rose-700" />
            Returned Cases
          </h3>
          <p className="mt-1 text-sm text-rose-700">
            Cases you have returned to the lawyer for corrections, most recent
            decision first.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
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
                  Returned
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {returnedCases.map((caseItem) => (
                <tr key={caseItem.id} className="hover:bg-rose-50/40">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-900">
                      {getCaseDisplayTitle(caseItem.title, caseItem.id)}
                    </p>
                    <p className="text-xs capitalize text-gray-500">
                      {caseItem.caseTypeLabel || `${caseItem.category} case`}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {caseItem.clientName}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {caseItem.lawyerName}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {caseItem.reviewedAt
                      ? new Date(caseItem.reviewedAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                      Returned
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {isLoading && (
            <p className="py-8 text-center text-sm text-gray-500">
              Loading returned cases…
            </p>
          )}

          {isError && (
            <p className="py-8 text-center text-sm text-rose-600">
              Could not load returned cases. Please try again.
            </p>
          )}

          {!isLoading && !isError && returnedCases.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">
              No returned cases yet.
            </p>
          )}
        </div>
      </Card>
    </RegistrarLayout>
  );
}
