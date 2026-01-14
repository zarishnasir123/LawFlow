import { ArrowLeft, Eye } from 'lucide-react';
import { mockCases } from '../data/viewcase.mock';
import type { Case } from '../types/case';
import { useNavigate } from "@tanstack/react-router";
export function ViewCases() {
  const navigate = useNavigate(); 

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
                  <th className="p-2 sm:p-3 text-left">Case No</th>
                  <th className="hidden sm:table-cell p-3 text-left">Title</th>
                  <th className="p-2 sm:p-3 text-left">Status</th>
                  <th className="p-2 sm:p-3 text-center">Action</th>
                </tr>
              </thead>

              <tbody>
                {mockCases.map((caseItem: Case) => (
                  <tr
                    key={caseItem.id}
                    className="border-t hover:bg-gray-50"
                  >
                    <td className="p-2 sm:p-3 text-xs sm:text-sm">{caseItem.caseNumber}</td>
                    <td className="hidden sm:table-cell p-3">{caseItem.title}</td>
                    <td className="p-2 sm:p-3">
                      <span className="px-2 sm:px-3 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700 inline-block">
                        {caseItem.status}
                      </span>
                    </td>
                    <td className="p-2 sm:p-3 text-center">
                      <button
                        onClick={() => navigate({ to: '/registrar-dashboard' })}
                        className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 border rounded hover:bg-gray-100 text-xs sm:text-sm transition-colors"
                      >
                        <Eye className="h-3 sm:h-4 w-3 sm:w-4" />
                        <span className="hidden sm:inline">View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {mockCases.length === 0 && (
              <p className="text-center text-gray-500 py-6 text-sm">
                No cases found
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}