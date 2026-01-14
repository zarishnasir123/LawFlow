import { ArrowLeft, Eye } from 'lucide-react';
import { mockCases } from '../data/viewcase.mock';
import type { Case } from '../types/case';
import { useNavigate } from "@tanstack/react-router";
export function ViewCases() {
  const navigate = useNavigate(); 

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#01411C] text-white py-4 px-6 shadow-md">
        <div className="container mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate({ to: '/registrar-dashboard' })}
            className="hover:bg-white/10 p-2 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">View Submitted Cases</h1>
        </div>
      </header>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-[#01411C] mb-6 font-semibold">
            Submitted Cases
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Case No</th>
                  <th className="p-3 text-left">Title</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>

              <tbody>
                {mockCases.map((caseItem: Case) => (
                  <tr
                    key={caseItem.id}
                    className="border-t hover:bg-gray-50"
                  >
                    <td className="p-3">{caseItem.caseNumber}</td>
                    <td className="p-3">{caseItem.title}</td>
                    <td className="p-3">
                      <span className="px-3 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">
                        {caseItem.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => navigate({ to: '/registrar-dashboard' })}
                        className="inline-flex items-center gap-1 px-3 py-1 border rounded hover:bg-gray-100"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {mockCases.length === 0 && (
              <p className="text-center text-gray-500 py-6">
                No cases found
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}