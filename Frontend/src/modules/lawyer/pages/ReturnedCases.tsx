import { useState } from "react";
import { AlertCircle, Search, FileText, Users, Phone, Mail, Bell, LogOut, User, UploadCloud, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import { getInitialCases } from "../data/cases.mock";

// Component to display all returned cases with filtering and search
// Returned cases are cases that were sent back by the registrar for corrections
export default function ReturnedCases() {
  const navigate = useNavigate();
  
  const allCases = getInitialCases();
  const returnedCases = allCases.filter((c) => c.status === "returned");

  const [searchTerm, setSearchTerm] = useState("");
  const [resubmitModal, setResubmitModal] = useState<{ caseId: string; caseTitle: string } | null>(null);

  // Filter cases by search term (title or client name)
  const filteredCases = returnedCases.filter(
    (caseItem) =>
      caseItem.caseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout
      brandTitle="LawFlow"
      brandSubtitle="Returned Cases"
      actions={[
        {
          label: "Notifications",
          icon: Bell,
          onClick: () => navigate({ to: "/Lawyer-dashboard" }),
          badge: 3,
        },
        {
          label: "Profile",
          icon: User,
          onClick: () => navigate({ to: "/Lawyer-dashboard" }),
        },
        {
          label: "Logout",
          icon: LogOut,
          onClick: () => navigate({ to: "/login" }),
        },
      ]}
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="mb-6 bg-white border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Returned Cases</p>
              <p className="text-3xl font-bold text-red-600">
                {returnedCases.length}
              </p>
            </div>
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by case title or client name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Cases List */}
        <div className="space-y-4">
          {filteredCases.length > 0 ? (
            filteredCases.map((caseItem) => (
              <div
                key={caseItem.id}
                className="bg-white border border-red-200 rounded-lg p-6 hover:shadow-lg transition"
              >
                {/* Returned Alert */}
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">
                      Reason for Return:
                    </p>
                    <p className="text-red-800 text-sm mt-1">
                      {caseItem.returnedReason}
                    </p>
                    {caseItem.returnedDate && (
                      <p className="text-red-700 text-xs mt-2">
                        Returned on: {caseItem.returnedDate}
                      </p>
                    )}
                  </div>
                </div>

                {/* Case Header */}
                <div className="mb-6 pb-4 border-b border-gray-200">
                  <div className="mb-2">
                    <h3 className="text-xl font-bold text-gray-900">
                      {caseItem.caseTitle}
                    </h3>
                    <p className="text-gray-600 text-sm mt-1">
                      {caseItem.description}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                      caseItem.caseType === "civil"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    {caseItem.caseType === "civil" ? "Civil" : "Family"} Case
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {/* Client Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      <p className="text-gray-600 text-sm font-medium">
                        Client
                      </p>
                    </div>
                    <p className="text-gray-900 font-semibold ml-7">
                      {caseItem.clientName}
                    </p>
                    <div className="flex items-center gap-2 mt-2 ml-7">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <a
                        href={`tel:${caseItem.clientPhone}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        {caseItem.clientPhone}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 mt-1 ml-7">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <a
                        href={`mailto:${caseItem.clientEmail}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        {caseItem.clientEmail}
                      </a>
                    </div>
                  </div>

                  {/* Filed and Progress */}
                  <div>
                    <p className="text-gray-600 text-sm font-medium mb-2">
                      Filed Date
                    </p>
                    <p className="text-gray-900 font-semibold ml-7">
                      {caseItem.filedDate}
                    </p>
                    <p className="text-gray-600 text-sm font-medium mt-3 mb-2">
                      Progress
                    </p>
                    <div className="ml-7">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${caseItem.progress}%` }}
                        ></div>
                      </div>
                      <p className="text-gray-700 text-xs mt-1">
                        {caseItem.progress}% Complete
                      </p>
                    </div>
                  </div>

                  {/* Documents and Fee */}
                  <div>
                    <p className="text-gray-600 text-sm font-medium mb-2">
                      Documents
                    </p>
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-green-600" />
                      <p className="text-gray-900 font-semibold">
                        {caseItem.documents} Files
                      </p>
                    </div>
                    <p className="text-gray-600 text-sm font-medium mt-3 mb-2">
                      Case Fee
                    </p>
                    <p className="text-gray-900 font-semibold ml-7">
                      Rs. {caseItem.totalFee.toLocaleString()}
                    </p>
                    <p className="text-green-600 text-sm ml-7">
                      Paid: Rs. {caseItem.paidAmount.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setResubmitModal({ caseId: caseItem.id, caseTitle: caseItem.caseTitle })}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    <UploadCloud className="w-4 h-4" />
                    Resubmit Case
                  </button>
                  <button
                    onClick={() => navigate({ to: `/lawyer-case-detail/${caseItem.id}` })}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    View Details
                  </button>
                  <button
                    onClick={() => alert(`Contact registered on: ${caseItem.clientPhone}`)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                  >
                    <Phone className="w-4 h-4" />
                    Contact Client
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">
                {searchTerm
                  ? "No returned cases found matching your search"
                  : "No returned cases at this time"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Resubmit Modal */}
      {resubmitModal && (
        <div className="fixed inset-0 backdrop-blur-md bg-white bg-opacity-10 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full md:max-w-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <UploadCloud className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-gray-900">Resubmit Case</h3>
              </div>
              <button
                onClick={() => setResubmitModal(null)}
                className="text-gray-500 hover:text-gray-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Case Title:</p>
                <p className="font-semibold text-gray-900">{resubmitModal.caseTitle}</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  Please ensure you have addressed all the concerns mentioned in the return reason before resubmitting this case with corrected documents.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Corrected Documents
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition cursor-pointer bg-gray-50">
                  <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX up to 10MB</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  placeholder="Add any notes about the resubmission..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setResubmitModal(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert(`Case ${resubmitModal.caseTitle} marked for resubmission. Documents will be reviewed.`);
                  setResubmitModal(null);
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
              >
                <UploadCloud className="w-4 h-4" />
                Resubmit
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
