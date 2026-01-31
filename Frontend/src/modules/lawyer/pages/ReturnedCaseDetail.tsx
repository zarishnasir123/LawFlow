import { useParams, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  FileText,
  Users,
  Phone,
  Mail,
  Calendar,
  Download,
  MessageSquare,
} from "lucide-react";
import LawyerLayout from "../components/LawyerLayout";
import { getInitialCases } from "../data/cases.mock";

// Detail page for a specific returned case
// Shows comprehensive information including return reason and allows resubmission
export default function ReturnedCaseDetail() {
  const { caseId } = useParams({ from: "/lawyer-case-detail/$caseId" });
  const navigate = useNavigate();
  const allCases = getInitialCases();
  const caseItem = allCases.find((c) => c.id === caseId);

  if (!caseItem) {
    return (
      <LawyerLayout brandTitle="Case Not Found">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500 text-lg">This returned case does not exist</p>
        </div>
      </LawyerLayout>
    );
  }

  return (
    <LawyerLayout
      brandTitle={caseItem.caseTitle}
      brandSubtitle="Returned Case Details"
    >
      <div className="space-y-6">
        {/* Back Button and Status */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate({ to: "/lawyer-returned-cases" })}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Returned Cases
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
            <AlertCircle className="w-4 h-4" />
            Status: Returned
          </div>
        </div>

        {/* Return Reason Alert - Prominent */}
        <div className="bg-red-50 border-l-4 border-red-600 rounded-lg p-6 space-y-3">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h2 className="text-lg font-bold text-red-900 mb-2">Reason for Return</h2>
              <p className="text-red-800 text-base leading-relaxed">{caseItem.returnedReason}</p>
              {caseItem.returnedDate && (
                <p className="text-red-700 text-sm mt-3">
                  📅 Returned on: <span className="font-semibold">{caseItem.returnedDate}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Case Header with Type */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{caseItem.caseTitle}</h1>
            <p className="text-gray-600">{caseItem.description}</p>
          </div>
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
            <span
              className={`inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold ${
                caseItem.caseType === "civil"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-purple-100 text-purple-800"
              }`}
            >
              {caseItem.caseType === "civil" ? "Civil" : "Family"} Case
            </span>
            <span className="inline-flex items-center gap-1 px-4 py-2 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold">
              Progress: {caseItem.progress}%
            </span>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Client and Case Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Information */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200">
                <Users className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-gray-900">Client Information</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Name</p>
                  <p className="text-gray-900 font-semibold text-lg">{caseItem.clientName}</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="text-gray-600 text-sm font-medium mb-1">Phone</p>
                    <a
                      href={`tel:${caseItem.clientPhone}`}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      <Phone className="w-4 h-4 inline mr-2" />
                      {caseItem.clientPhone}
                    </a>
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-600 text-sm font-medium mb-1">Email</p>
                    <a
                      href={`mailto:${caseItem.clientEmail}`}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      <Mail className="w-4 h-4 inline mr-2" />
                      {caseItem.clientEmail}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Case Details */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200">
                <FileText className="w-6 h-6 text-green-600" />
                <h3 className="text-xl font-bold text-gray-900">Case Details</h3>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-2">Filed Date</p>
                  <p className="text-gray-900 font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    {caseItem.filedDate}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-2">Opposite Party</p>
                  <p className="text-gray-900 font-semibold">{caseItem.oppositeParty}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-2">Next Hearing</p>
                  <p className="text-gray-900 font-semibold">{caseItem.nextHearing}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-2">Total Documents</p>
                  <p className="text-gray-900 font-semibold">{caseItem.documents} Files</p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Case Progress</h3>
              <div className="space-y-3">
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all"
                    style={{ width: `${caseItem.progress}%` }}
                  ></div>
                </div>
                <p className="text-gray-700 font-semibold text-center">{caseItem.progress}% Complete</p>
              </div>
            </div>
          </div>

          {/* Right Column - Fee Information and Actions */}
          <div className="space-y-6">
            {/* Fee Summary */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Fee Information</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <p className="text-gray-600">Total Fee</p>
                  <p className="text-gray-900 font-bold">Rs. {caseItem.totalFee.toLocaleString()}</p>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <p className="text-gray-600">Amount Paid</p>
                  <p className="text-green-600 font-bold">Rs. {caseItem.paidAmount.toLocaleString()}</p>
                </div>
                <div className="flex justify-between items-center bg-orange-50 p-3 rounded-lg">
                  <p className="text-gray-900 font-semibold">Outstanding</p>
                  <p className="text-orange-600 font-bold">
                    Rs. {(caseItem.totalFee - caseItem.paidAmount).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
              <button
                onClick={() => alert("Download case documents")}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
              >
                <Download className="w-5 h-5" />
                Download Documents
              </button>
              <button
                onClick={() => alert("Message registrar about this case")}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
              >
                <MessageSquare className="w-5 h-5" />
                Message Registrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </LawyerLayout>
  );
}
