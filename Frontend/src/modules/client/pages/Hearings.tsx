import { useState } from "react";
import {
  Clock,
  CheckCircle,
  ClipboardList,
  Calendar,
  MapPin,
  Gavel,
  Building2,
  RotateCw,
  AlertTriangle,
  FileText,
  Download,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import ClientLayout from "../components/ClientLayout";
import { getInitialHearings } from "../data/hearings.mock";

interface Hearing {
  id: string;
  caseNumber: string;
  caseTitle: string;
  client: string;
  caseType: "civil" | "family";
  courtName: string;
  location: string;
  dateTime: string;
  judge?: string;
  status: "upcoming" | "completed" | "postponed" | "adjourned";
  notes?: string;
  nextHearing?: string;
}

const mockHearings: Hearing[] = getInitialHearings();

export default function LawyerHearings() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed">("upcoming");

  const filteredHearings = mockHearings.filter((hearing) => {
    if (filter === "all") return true;
    return hearing.status === filter;
  });

  const upcomingCount = mockHearings.filter((h) => h.status === "upcoming").length;
  const completedCount = mockHearings.filter((h) => h.status === "completed").length;

  return (
    <ClientLayout
      brandSubtitle="Hearings"
      showBackButton
      onBackClick={() => navigate({ to: "/client-dashboard" })}
    >
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Hearings</h1>
          <p className="text-sm text-gray-600 mt-1">
            Hearings assigned by registrar. Keep track of all your scheduled court appearances.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Upcoming Hearings</p>
                <p className="text-2xl font-bold text-blue-600">{upcomingCount}</p>
              </div>
              <Clock className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed Hearings</p>
                <p className="text-2xl font-bold text-green-600">{completedCount}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Hearings</p>
                <p className="text-2xl font-bold text-purple-600">{mockHearings.length}</p>
              </div>
              <ClipboardList className="w-10 h-10 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === "all"
                ? "bg-green-700 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("upcoming")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === "upcoming"
                ? "bg-green-700 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilter("completed")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === "completed"
                ? "bg-green-700 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Completed
          </button>
        </div>

        {/* Hearings List */}
        <div className="space-y-4">
          {filteredHearings.map((hearing) => (
            <div
              key={hearing.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition"
            >
              {/* Case Header */}
              <div className="mb-6 pb-4 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h2 className="text-xl font-bold text-gray-900">
                        {hearing.caseNumber}
                      </h2>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                        Scheduled
                      </span>
                      {hearing.status === "upcoming" && (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                          First Hearing
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 font-medium">{hearing.caseTitle}</p>
                    <p className="text-gray-600 text-sm mt-1">Client: {hearing.client}</p>
                  </div>
                  <div
                    className={`inline-block px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap ${
                      hearing.status === "upcoming"
                        ? "bg-green-50 text-green-700"
                        : hearing.status === "completed"
                        ? "bg-gray-50 text-gray-700"
                        : "bg-orange-50 text-orange-700"
                    }`}
                  >
                    {hearing.status === "upcoming"
                      ? "⏱️ Upcoming"
                      : hearing.status === "completed"
                      ? "✅ Completed"
                      : hearing.status === "postponed"
                      ? "⏸️ Postponed"
                      : "📋 Adjourned"}
                  </div>
                </div>
              </div>

              {/* Hearing Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                {/* Date & Time */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <p className="text-gray-600 text-sm font-medium">Hearing Date & Time</p>
                  </div>
                  <p className="text-gray-900 font-semibold ml-7">{hearing.dateTime}</p>
                </div>

                {/* Location */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-5 h-5 text-red-600" />
                    <p className="text-gray-600 text-sm font-medium">Location</p>
                  </div>
                  <p className="text-gray-900 font-semibold ml-7">{hearing.location}</p>
                </div>

                {/* Judge */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Gavel className="w-5 h-5 text-orange-600" />
                    <p className="text-gray-600 text-sm font-medium">Presiding Judge</p>
                  </div>
                  <p className="text-gray-900 font-semibold ml-7">
                    {hearing.judge || "Not Assigned"}
                  </p>
                </div>

                {/* Court Name */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-5 h-5 text-slate-600" />
                    <p className="text-gray-600 text-sm font-medium">Court Name</p>
                  </div>
                  <p className="text-gray-900 font-semibold ml-7">{hearing.courtName}</p>
                </div>

                {/* Case Type */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardList className="w-5 h-5 text-purple-600" />
                    <p className="text-gray-600 text-sm font-medium">Case Type</p>
                  </div>
                  <p className="text-gray-900 font-semibold ml-7 capitalize">
                    {hearing.caseType}
                  </p>
                </div>

                {/* Next Hearing */}
                {hearing.nextHearing && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <RotateCw className="w-5 h-5 text-green-600" />
                      <p className="text-gray-600 text-sm font-medium">Next Hearing</p>
                    </div>
                    <p className="text-gray-900 font-semibold ml-7">{hearing.nextHearing}</p>
                  </div>
                )}
              </div>

              {/* Important Instructions */}
              {hearing.notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex gap-3">
                    <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-800 font-semibold text-sm">Important Instructions</p>
                      <p className="text-yellow-700 text-sm mt-1">{hearing.notes}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Add to Calendar
                </button>
                <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  View Case Details
                </button>
                {hearing.status === "upcoming" && (
                  <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Download Notice
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredHearings.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-600 text-lg">No {filter !== "all" ? filter : ""} hearings found.</p>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
