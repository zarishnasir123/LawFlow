import { useState, useEffect } from "react";
import {
  Clock,
  CheckCircle,
  ClipboardList,
  Calendar,
  MapPin,
  AlertCircle
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import ClientLayout from "../components/ClientLayout";
import { clientHearingsApi } from "../api/hearings.api";
import { getRegistrarErrorMessage, type Hearing } from "../../registrar/api";

export default function ClientHearings() {
  const navigate = useNavigate();
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed">("upcoming");

  const fetchHearings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientHearingsApi.listMyHearings();
      setHearings(data);
    } catch (err) {
      setError(getRegistrarErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHearings();
  }, []);

  const filteredHearings = hearings.filter((hearing) => {
    if (filter === "all") return true;
    if (filter === "upcoming") return hearing.status === "scheduled" || hearing.status === "proposed";
    if (filter === "completed") return hearing.status === "completed" || hearing.status === "adjourned";
    return true;
  });

  const upcomingCount = hearings.filter((h) => h.status === "scheduled" || h.status === "proposed").length;
  const completedCount = hearings.filter((h) => h.status === "completed" || h.status === "adjourned").length;

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "";
    const hour = parseInt(timeStr.substring(0, 2), 10);
    const suffix = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${String(formattedHour).padStart(2, "0")}:${timeStr.substring(3, 5)} ${suffix}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "proposed":
        return "bg-amber-100 text-amber-800";
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-emerald-100 text-emerald-800";
      case "adjourned":
        return "bg-purple-100 text-purple-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "proposed":  return "Pending Confirmation";
      case "scheduled": return "Scheduled";
      case "completed": return "Completed";
      case "adjourned": return "Adjourned";
      case "cancelled": return "Cancelled";
      default: return status;
    }
  };

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

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-red-700 border border-red-200 shadow-sm flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Upcoming Hearings</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{upcomingCount}</p>
              </div>
              <Clock className="w-10 h-10 text-blue-500 bg-blue-50 p-1.5 rounded-full" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Completed Hearings</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{completedCount}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-emerald-500 bg-emerald-50 p-1.5 rounded-full" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Hearings</p>
                <p className="text-2xl font-bold text-[#01411C] mt-1">{hearings.length}</p>
              </div>
              <ClipboardList className="w-10 h-10 text-[#01411C] bg-emerald-50 p-1.5 rounded-full" />
            </div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2">
          {[
            { value: "all", label: "All" },
            { value: "upcoming", label: "Upcoming" },
            { value: "completed", label: "Completed" }
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value as "all" | "upcoming" | "completed")}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition border ${
                filter === item.value
                  ? "bg-[#01411C] text-white border-[#01411C] shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Hearings List */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#01411C] border-t-transparent"></div>
          </div>
        ) : filteredHearings.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-500 shadow-sm">
            No hearings found matching selection.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHearings.map((hearing) => (
              <div
                key={hearing.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition shadow-sm"
              >
                {/* Case Header */}
                <div className="mb-4 pb-4 border-b border-gray-150">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusBadge(hearing.status)}`}>
                          {getStatusLabel(hearing.status)}
                        </span>
                        <span className="text-xs font-bold text-gray-400">
                          Hearing #{hearing.hearingNumber}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 leading-snug">
                        {hearing.caseTitle}
                      </h3>
                    </div>
                    <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-bold">
                      Hearing #{hearing.hearingNumber}: {hearing.hearingType}
                    </span>
                  </div>
                </div>

                {/* Hearing Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {/* Date */}
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hearing Date</p>
                      <p className="text-sm font-semibold text-gray-800 mt-0.5">{hearing.hearingDate}</p>
                    </div>
                  </div>

                  {/* Time */}
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Time Slot</p>
                      <p className="text-sm font-semibold text-gray-800 mt-0.5">
                        {formatTime(hearing.startTime)} - {formatTime(hearing.endTime)}
                      </p>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Court Room</p>
                      <p className="text-sm font-semibold text-gray-800 mt-0.5">{hearing.courtroomName}</p>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
