import { useState } from "react";
import {
  Bell,
  LogOut,
  User,
  Search,
  CheckCircle,
  Clock,
  FileText,
  Phone,
  Mail,
  Calendar,
  Users,
  DollarSign,
  Pause,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import { getInitialCases } from "../data/cases.mock";

// Case interface matching mock data
interface Case {
  id: string;
  caseNumber: string;
  caseTitle: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  caseType: "civil" | "family";
  status: "active" | "pending" | "closed" | "on-hold" | "returned";
  filedDate: string;
  description: string;
  oppositeParty: string;
  nextHearing: string;
  progress: number;
  documents: number;
  totalFee: number;
  paidAmount: number;
  returnedReason?: string;
  returnedDate?: string;
}

const mockCases: Case[] = getInitialCases();

// Returns the appropriate icon for each case status
// Returned cases show an AlertCircle icon in red to indicate action needed
const getStatusIcon = (status: string) => {
  switch (status) {
    case "active":
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    case "pending":
      return <Clock className="w-5 h-5 text-blue-600" />;
    case "on-hold":
      return <Pause className="w-5 h-5 text-orange-600" />;
    case "closed":
      return <CheckCircle className="w-5 h-5 text-gray-600" />;
    case "returned":
      return <AlertCircle className="w-5 h-5 text-red-600" />;
    default:
      return null;
  }
};

// Returns the appropriate color classes for each case status
// Returned cases use red styling to highlight attention needed
const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-blue-100 text-blue-800";
    case "on-hold":
      return "bg-orange-100 text-orange-800";
    case "closed":
      return "bg-gray-100 text-gray-800";
    case "returned":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export default function LawyerCases() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "pending" | "on-hold" | "closed" | "returned">("active");

  const filteredCases = mockCases.filter((caseItem) => {
    const matchesSearch =
      caseItem.caseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.clientName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === "all" || caseItem.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const activeCasesCount = mockCases.filter((c) => c.status === "active").length;
  const pendingCasesCount = mockCases.filter((c) => c.status === "pending").length;
  const returnedCasesCount = mockCases.filter((c) => c.status === "returned").length;
  const totalCasesCount = mockCases.length;

  return (
    <DashboardLayout
      brandTitle="LawFlow"
      brandSubtitle="Lawyer Portal"
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
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Cases</h1>
          <p className="text-gray-600 mt-1">
            View and manage all your active cases with clients
          </p>
        </div>

        {/* Statistics Cards */}
        {/* Shows case counts: Active, Pending, Returned (needs attention), and Total */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Cases</p>
                <p className="text-2xl font-bold text-green-600">
                  {activeCasesCount}
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Cases</p>
                <p className="text-2xl font-bold text-blue-600">
                  {pendingCasesCount}
                </p>
              </div>
              <Clock className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          {/* Returned Cases Stat Card */}
          <div className="bg-white border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Returned Cases</p>
                <p className="text-2xl font-bold text-red-600">
                  {returnedCasesCount}
                </p>
              </div>
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Cases</p>
                <p className="text-2xl font-bold text-purple-600">
                  {totalCasesCount}
                </p>
              </div>
              <FileText className="w-10 h-10 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="space-y-4">
          {/* Search Bar */}
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

          {/* Filter */}
          <div className="flex flex-wrap gap-2">
            {["all", "active", "pending", "on-hold", "returned", "closed"].map(
              (status) => (
                <button
                  key={status}
                  onClick={() =>
                    setFilterStatus(
                      status as
                        | "all"
                        | "active"
                        | "pending"
                        | "on-hold"
                        | "returned"
                        | "closed"
                    )
                  }
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                    filterStatus === status
                      ? "bg-green-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              )
            )}
          </div>
        </div>

        {/* Cases List */}
        <div className="space-y-4">
          {filteredCases.length > 0 ? (
            filteredCases.map((caseItem) => (
              <div
                key={caseItem.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition"
              >
                {/* Returned Case Alert - Displays prominent alert when case is returned by registrar */}
                {/* Shows the reason for return and the date returned */}
                {caseItem.status === "returned" && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-900">Case Returned</p>
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
                )}

                {/* Case Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 pb-4 border-b border-gray-200">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${getStatusColor(
                          caseItem.status
                        )}`}
                      >
                        {getStatusIcon(caseItem.status)}
                        {caseItem.status.charAt(0).toUpperCase() +
                          caseItem.status.slice(1)}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          caseItem.caseType === "civil"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {caseItem.caseType === "civil"
                          ? "Civil"
                          : "Family"}{" "}
                        Case
                      </span>
                    </div>
                    <p className="text-lg text-gray-700 font-medium">
                      {caseItem.caseTitle}
                    </p>
                    <p className="text-gray-600 text-sm mt-1">
                      {caseItem.description}
                    </p>
                  </div>
                </div>

                {/* Client and Case Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 pb-6 border-b border-gray-200">
                  {/* Client Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      <p className="text-gray-600 text-sm font-medium">Client</p>
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

                  {/* Opposite Party */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-orange-600" />
                      <p className="text-gray-600 text-sm font-medium">
                        Opposite Party
                      </p>
                    </div>
                    <p className="text-gray-900 font-semibold ml-7">
                      {caseItem.oppositeParty}
                    </p>
                  </div>

                  {/* Next Hearing */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-5 h-5 text-green-600" />
                      <p className="text-gray-600 text-sm font-medium">
                        Next Hearing
                      </p>
                    </div>
                    <p className="text-gray-900 font-semibold ml-7">
                      {caseItem.nextHearing}
                    </p>
                  </div>

                  {/* Filed Date */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-purple-600" />
                      <p className="text-gray-600 text-sm font-medium">
                        Filed Date
                      </p>
                    </div>
                    <p className="text-gray-900 font-semibold ml-7">
                      {caseItem.filedDate}
                    </p>
                  </div>
                </div>

                {/* Progress and Financial Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                  {/* Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-gray-600 text-sm font-medium">
                        Case Progress
                      </p>
                      <p className="text-gray-900 font-semibold">
                        {caseItem.progress}%
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-green-600 h-2.5 rounded-full transition-all"
                        style={{ width: `${caseItem.progress}%` }}
                      ></div>
                    </div>
                    <p className="text-gray-500 text-xs mt-2">
                      {caseItem.documents} documents uploaded
                    </p>
                  </div>

                  {/* Financial Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      <p className="text-gray-600 text-sm font-medium">
                        Fee Status
                      </p>
                    </div>
                    <div className="ml-7 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 text-sm">Total Fee:</span>
                        <span className="text-gray-900 font-semibold">
                          PKR {caseItem.totalFee.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 text-sm">Paid:</span>
                        <span className="text-green-600 font-semibold">
                          PKR {caseItem.paidAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="text-gray-600 text-sm font-medium">
                          Pending:
                        </span>
                        <span className="text-orange-600 font-bold">
                          PKR{" "}
                          {(caseItem.totalFee - caseItem.paidAmount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    View Details
                  </button>
                  <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Message Client
                  </button>
                  <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Schedule Hearing
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">
                No cases found matching your search.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
