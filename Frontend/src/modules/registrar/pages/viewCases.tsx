import { ArrowLeft, Eye } from 'lucide-react';
import { useNavigate } from "@tanstack/react-router";
import { useCaseFilingStore } from "../../lawyer/store/caseFiling.store";

export function ViewCases() {
  const navigate = useNavigate(); 
  const submittedCases = useCaseFilingStore((state) =>
    state.getSubmittedCasesForRegistrar()
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#01411C] text-white py-3 sm:py-4 px-4 sm:px-6 shadow-md sticky top-0 z-50">
        <div className="container mx-auto flex items-center gap-4">

          <button
            onClick={() => navigate({ to: '/registrar-dashboard' })}
            className="hover:bg-white/10 p-2 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 sm:h-5 w-4 sm:w-5" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold">View Submitted Cases</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-[#01411C] mb-4 sm:mb-6 font-semibold text-base sm:text-lg">
            Submitted Cases
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 text-xs sm:text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 sm:p-3 text-left">Case ID</th>
                  <th className="hidden sm:table-cell p-3 text-left">Title</th>
                  <th className="hidden sm:table-cell p-3 text-left">Client</th>
                  <th className="p-2 sm:p-3 text-left">Status</th>
                  <th className="p-2 sm:p-3 text-center">Action</th>
                </tr>
              </thead>

              <tbody>
                {submittedCases.map((caseItem) => (
                  <tr key={caseItem.caseId} className="border-t hover:bg-gray-50">
                    <td className="p-2 sm:p-3 text-xs sm:text-sm">{caseItem.displayCaseId}</td>
                    <td className="hidden sm:table-cell p-3">{caseItem.title}</td>
                    <td className="hidden sm:table-cell p-3">{caseItem.clientName}</td>
                    <td className="p-2 sm:p-3">
                      <span className="px-2 sm:px-3 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700 inline-block">
                        Pending Review
                      </span>
                    </td>
                    <td className="p-2 sm:p-3 text-center">
                      <button
                        onClick={() => navigate({ to: '/review-cases/$caseId', params: { caseId: caseItem.caseId } })}
                        className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 border rounded hover:bg-gray-100 text-xs sm:text-sm transition-colors"
                      >
                        <Eye className="h-3 sm:h-4 w-3 sm:w-4" />
                        <span className="hidden sm:inline">Review Cases</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {submittedCases.length === 0 && (
              <p className="text-center text-gray-500 py-6 text-sm">
                No submitted cases available yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
