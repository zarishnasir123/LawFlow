import { useMemo, useState } from "react";
import {
  AlertCircle,
  FileText,
  Mail,
  Phone,
  Search,
  UploadCloud,
  Users,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import LawyerLayout from "../components/LawyerLayout";
import { casesApi, type ReturnedCase } from "../api/cases.api";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatRs(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-PK")}`;
}

// Lawyer "Returned Cases" — the lawyer's cases the registrar sent back for
// corrections (status='returned'), with the real return reason, client info,
// document count, and fee/paid. The single action opens the editor so the
// lawyer fixes the document and resubmits from there. There is no "progress"
// concept in the system, so none is shown.
export default function ReturnedCases() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: returnedCases,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["lawyer", "returned-cases"],
    queryFn: casesApi.getReturnedCases,
  });

  const filteredCases = useMemo(() => {
    const list = returnedCases ?? [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (c) =>
        c.title.toLowerCase().includes(term) ||
        c.clientName.toLowerCase().includes(term)
    );
  }, [returnedCases, searchTerm]);

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle="Returned Cases">
      <div className="space-y-6">
        {/* Total */}
        <div className="mb-6 bg-white border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Returned Cases</p>
              <p className="text-3xl font-bold text-red-600">
                {isLoading ? "—" : returnedCases?.length ?? 0}
              </p>
            </div>
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
        </div>

        {/* Search */}
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

        {/* List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-500">
              Loading returned cases…
            </div>
          ) : isError ? (
            <div className="bg-white border border-red-200 rounded-lg p-12 text-center text-red-600">
              Could not load returned cases. Please try again.
            </div>
          ) : filteredCases.length > 0 ? (
            filteredCases.map((caseItem) => (
              <ReturnedCaseCard
                key={caseItem.id}
                caseItem={caseItem}
                onFixResubmit={() =>
                  navigate({ to: `/lawyer-case-editor/${caseItem.id}` })
                }
              />
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
    </LawyerLayout>
  );
}

function ReturnedCaseCard({
  caseItem,
  onFixResubmit,
}: {
  caseItem: ReturnedCase;
  onFixResubmit: () => void;
}) {
  const isCivil = caseItem.category === "civil";

  return (
    <div className="bg-white border border-red-200 rounded-lg p-6 hover:shadow-lg transition">
      {/* Return reason */}
      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-900">Reason for Return:</p>
          <p className="text-red-800 text-sm mt-1">
            {caseItem.reviewRemarks?.trim() ||
              "The registrar returned this case without a written reason."}
          </p>
          {caseItem.reviewedAt && (
            <p className="text-red-700 text-xs mt-2">
              Returned on: {formatDate(caseItem.reviewedAt)}
            </p>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900">{caseItem.title}</h3>
        {caseItem.description && (
          <p className="text-gray-600 text-sm mt-1">{caseItem.description}</p>
        )}
        <span
          className={`mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
            isCivil
              ? "bg-blue-100 text-blue-800"
              : "bg-purple-100 text-purple-800"
          }`}
        >
          {isCivil ? "Civil" : "Family"} Case
        </span>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Client */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-600" />
            <p className="text-gray-600 text-sm font-medium">Client</p>
          </div>
          <p className="text-gray-900 font-semibold ml-7">
            {caseItem.clientName}
          </p>
          {caseItem.clientPhone && (
            <div className="flex items-center gap-2 mt-2 ml-7">
              <Phone className="w-4 h-4 text-gray-500" />
              <a
                href={`tel:${caseItem.clientPhone}`}
                className="text-blue-600 hover:underline text-sm"
              >
                {caseItem.clientPhone}
              </a>
            </div>
          )}
          {caseItem.clientEmail && (
            <div className="flex items-center gap-2 mt-1 ml-7">
              <Mail className="w-4 h-4 text-gray-500" />
              <a
                href={`mailto:${caseItem.clientEmail}`}
                className="text-blue-600 hover:underline text-sm"
              >
                {caseItem.clientEmail}
              </a>
            </div>
          )}
        </div>

        {/* Filed date */}
        <div>
          <p className="text-gray-600 text-sm font-medium mb-2">Filed Date</p>
          <p className="text-gray-900 font-semibold ml-7">
            {formatDate(caseItem.submittedAt)}
          </p>
        </div>

        {/* Documents + Fee */}
        <div>
          <p className="text-gray-600 text-sm font-medium mb-2">Documents</p>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-600" />
            <p className="text-gray-900 font-semibold">
              {caseItem.documentCount}{" "}
              {caseItem.documentCount === 1 ? "File" : "Files"}
            </p>
          </div>

          {caseItem.caseFee !== null && (
            <>
              <p className="text-gray-600 text-sm font-medium mt-3 mb-2">
                Case Fee
              </p>
              <p className="text-gray-900 font-semibold ml-7">
                {formatRs(caseItem.caseFee)}
              </p>
              {caseItem.paidAmount !== null && (
                <p className="text-green-600 text-sm ml-7">
                  Paid: {formatRs(caseItem.paidAmount)}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Action — fix the document in the editor, then resubmit from there */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={onFixResubmit}
          className="flex items-center gap-2 px-4 py-2 bg-[#01411C] text-white rounded-lg hover:bg-[#024a23] transition font-medium"
        >
          <UploadCloud className="w-4 h-4" />
          Fix &amp; Resubmit
        </button>
      </div>
    </div>
  );
}
