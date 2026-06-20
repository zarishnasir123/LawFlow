import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import RegistrarLayout from "../components/RegistrarLayout";
import Card from "../../../shared/components/dashboard/Card";
import { Calendar, Clock, MapPin, CheckCircle, ChevronRight, Edit3, Trash2, Search, ChevronDown, ChevronUp, Users } from "lucide-react";
import {
  listRegistrarHearings,
  recordOutcome,
  rescheduleHearing,
  cancelHearing,
  listCourtrooms,
  getRegistrarErrorMessage,
  type Hearing,
  type Courtroom,
  type HearingOutcomeType
} from "../api";

export default function RegistrarHearings() {
  const navigate = useNavigate();
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all"); // empty means All
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCases, setExpandedCases] = useState<Record<string, boolean>>({});

  // Courtrooms list for reschedule
  const [courtrooms, setCourtrooms] = useState<Courtroom[]>([]);

  // Modal states
  const [outcomeModalHearing, setOutcomeModalHearing] = useState<Hearing | null>(null);
  const [outcome, setOutcome] = useState<HearingOutcomeType>("completed");
  const [remarks, setRemarks] = useState("");
  const [nextHearingType, setNextHearingType] = useState("");

  const [rescheduleModalHearing, setRescheduleModalHearing] = useState<Hearing | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleRoom, setRescheduleRoom] = useState("");

  useEffect(() => {
    const loadHearings = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await listRegistrarHearings(filter === "all" ? undefined : filter);
        setHearings(data);
      } catch (err) {
        setError(getRegistrarErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    loadHearings();
  }, [filter]);

  useEffect(() => {
    async function loadRooms() {
      try {
        const rooms = await listCourtrooms();
        setCourtrooms(rooms);
      } catch (e) {
        console.error("Failed to load courtrooms", e);
      }
    }
    loadRooms();
  }, []);

  const handleOutcomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcomeModalHearing) return;
    try {
      setError(null);
      await recordOutcome(outcomeModalHearing.id, {
        outcome,
        remarks: remarks || undefined,
        nextHearingType: outcome === "adjourned" && nextHearingType ? nextHearingType : undefined
      });
      setOutcomeModalHearing(null);
      setRemarks("");
      setNextHearingType("");
      loadHearings();
    } catch (err) {
      setError(getRegistrarErrorMessage(err));
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleModalHearing || !rescheduleDate || !rescheduleTime || !rescheduleRoom) return;
    try {
      setError(null);
      await rescheduleHearing(rescheduleModalHearing.id, {
        newDate: rescheduleDate,
        newStartTime: rescheduleTime,
        newCourtroomId: rescheduleRoom
      });
      setRescheduleModalHearing(null);
      loadHearings();
    } catch (err) {
      setError(getRegistrarErrorMessage(err));
    }
  };

  const handleCancelClick = async (hearingId: string) => {
    if (!window.confirm("Are you sure you want to cancel this hearing? This will notify all parties.")) return;
    try {
      setError(null);
      await cancelHearing(hearingId);
      loadHearings();
    } catch (err) {
      setError(getRegistrarErrorMessage(err));
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "proposed":
        return "bg-amber-100 text-amber-800 border border-amber-200";
      case "scheduled":
        return "bg-blue-100 text-blue-800 border border-blue-200";
      case "completed":
        return "bg-emerald-100 text-emerald-800 border border-emerald-200";
      case "adjourned":
        return "bg-purple-100 text-purple-800 border border-purple-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border border-red-200";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "";
    const hour = parseInt(timeStr.substring(0, 2), 10);
    const suffix = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${String(formattedHour).padStart(2, "0")}:${timeStr.substring(3, 5)} ${suffix}`;
  };

  const filteredHearings = hearings.filter((h) => {
    const matchesStatus = filter === "all" || h.status === filter;
    if (!matchesStatus) return false;

    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      h.caseTitle?.toLowerCase().includes(query) ||
      h.lawyerName?.toLowerCase().includes(query) ||
      h.courtroomName?.toLowerCase().includes(query) ||
      h.hearingType?.toLowerCase().includes(query)
    );
  });

  // Group filtered hearings by Case
  const groupedHearings = Object.values(
    filteredHearings.reduce((acc, hearing) => {
      if (!acc[hearing.caseId]) {
        acc[hearing.caseId] = {
          caseId: hearing.caseId,
          caseTitle: hearing.caseTitle,
          lawyerName: hearing.lawyerName,
          hearings: []
        };
      }
      acc[hearing.caseId].hearings.push(hearing);
      return acc;
    }, {} as Record<string, { caseId: string; caseTitle: string; lawyerName: string; hearings: Hearing[] }>)
  );

  const toggleCase = (caseId: string) => {
    setExpandedCases((prev) => ({
      ...prev,
      [caseId]: !prev[caseId]
    }));
  };

  // Compute stats based on UNFILTERED hearings
  const counts = hearings.reduce((acc, h) => {
    acc.all++;
    acc[h.status] = (acc[h.status] || 0) + 1;
    return acc;
  }, { all: 0, proposed: 0, scheduled: 0, completed: 0, adjourned: 0, cancelled: 0 } as Record<string, number>);

  return (
    <RegistrarLayout pageSubtitle="Manage Hearings" notificationBadge={0}>
      <div className="mx-auto max-w-5xl space-y-6">
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#01411C]">Hearings Management Queue</h1>
            <p className="text-sm text-gray-500">Track schedules, confirm proposed dates, record trial outcomes and handle holiday adjustments.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate({ to: "/registrar-holidays" })}
              className="rounded-lg border border-[#01411C] bg-white px-4 py-2 text-sm font-semibold text-[#01411C] transition-all hover:bg-emerald-50"
            >
              Manage Holidays
            </button>
            <button
              onClick={() => navigate({ to: "/registrar-courtrooms" })}
              className="rounded-lg border border-[#01411C] bg-[#01411C] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#024a23]"
            >
              Courtrooms List
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-red-700 border border-red-200 shadow-sm">
            {error}
          </div>
        )}

        {/* Search + tabs */}
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by case title, lawyer, or room…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50/60 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "All" },
              { value: "proposed", label: "Proposed" },
              { value: "scheduled", label: "Scheduled" },
              { value: "completed", label: "Completed" },
              { value: "adjourned", label: "Adjourned" },
              { value: "cancelled", label: "Cancelled" }
            ].map((tab) => {
              const active = filter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setFilter(tab.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    active
                      ? "bg-[#01411C] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      active ? "bg-white/20" : "bg-white text-gray-600"
                    }`}
                  >
                    {counts[tab.value] || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Hearings List */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#01411C] border-t-transparent"></div>
          </div>
        ) : groupedHearings.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-2 border-gray-200 bg-gray-50">
            <Search className="mx-auto h-8 w-8 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No hearings found matching your criteria.</p>
            <button 
              onClick={() => { setFilter("all"); setSearchQuery(""); }} 
              className="mt-3 text-sm text-[#01411C] hover:underline font-semibold"
            >
              Clear filters & search
            </button>
          </Card>
        ) : (
          <div className="space-y-4">
            {groupedHearings.map((group) => {
              const isExpanded = expandedCases[group.caseId];
              return (
                <div key={group.caseId} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm transition hover:border-emerald-200 hover:shadow-md">
                  <div 
                    className="p-5 cursor-pointer select-none bg-white flex items-start justify-between gap-4"
                    onClick={() => toggleCase(group.caseId)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          {group.hearings.length} {group.hearings.length === 1 ? "Hearing" : "Hearings"}
                        </span>
                      </div>
                      <h3 className="truncate text-lg font-semibold text-gray-900">
                        {group.caseTitle}
                      </h3>
                      {group.lawyerName && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-600">
                          <Users className="h-3.5 w-3.5 text-gray-400" />
                          <span>Lawyer: </span>
                          <span className="font-medium text-gray-800">{group.lawyerName}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-shrink-0 flex flex-col items-end justify-center">
                      <button className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
                        View Hearings
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.hearings.map((hearing) => (
                          <div key={hearing.id} className="rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col overflow-hidden transition hover:shadow-md">
                            <div className="flex items-start justify-between border-b border-gray-100 bg-gray-50/50 p-3">
                              <div>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(hearing.status)}`}>
                                  {hearing.status}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded shadow-sm">
                                Hearing #{hearing.hearingNumber}: {hearing.hearingType}
                              </span>
                            </div>

                            <div className="p-4 space-y-3 flex-1 bg-white">
                              <div className="text-xs font-semibold text-gray-400">
                                Hearing #{hearing.hearingNumber}
                              </div>
                              <div className="space-y-2 text-sm text-gray-600">
                                <div className="flex items-center gap-2.5">
                                  <Calendar className="h-4 w-4 text-emerald-600 shrink-0" />
                                  <span className="font-medium text-gray-800">{hearing.hearingDate}</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                  <Clock className="h-4 w-4 text-emerald-600 shrink-0" />
                                  <span className="font-medium text-gray-800">{formatTime(hearing.startTime)}</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                  <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                                  <span className="font-medium text-gray-800">{hearing.courtroomName}</span>
                                </div>
                              </div>
                            </div>

                            {/* Footer actions */}
                            <div className="bg-gray-50 border-t p-3 flex gap-2">
                              {hearing.status === "proposed" && (
                                <button
                                  onClick={() => navigate({ to: `/schedule-hearing/${hearing.caseId}` })}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-md bg-[#01411C] py-2 text-xs font-bold text-white transition-colors hover:bg-[#024a23]"
                                >
                                  Confirm / Adjust
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {hearing.status === "scheduled" && (
                                <>
                                  <button
                                    onClick={() => {
                                      setOutcomeModalHearing(hearing);
                                      setRemarks("");
                                      setOutcome("completed");
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1 rounded-md bg-emerald-700 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-800"
                                  >
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Outcome
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRescheduleModalHearing(hearing);
                                      setRescheduleDate(hearing.hearingDate);
                                      setRescheduleTime(hearing.startTime);
                                      setRescheduleRoom(hearing.courtroomId);
                                    }}
                                    className="rounded-md border border-gray-300 bg-white p-1.5 text-gray-600 transition-colors hover:bg-gray-50"
                                    title="Reschedule"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleCancelClick(hearing.id)}
                                    className="rounded-md border border-red-200 bg-white p-1.5 text-red-600 transition-colors hover:bg-red-50"
                                    title="Cancel"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Outcome Recording */}
        {outcomeModalHearing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-gray-100">
              <h3 className="text-lg font-bold text-[#01411C] border-b pb-3 mb-4">Record Hearing Outcome</h3>
              <p className="text-xs font-semibold text-gray-700 mb-1">Case: {outcomeModalHearing.caseTitle}</p>
              <p className="text-xs text-gray-500 mb-4">Hearing #{outcomeModalHearing.hearingNumber}: {outcomeModalHearing.hearingType}</p>
              
              <form onSubmit={handleOutcomeSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700">Select Outcome</label>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value as HearingOutcomeType)}
                    className="w-full rounded-md border border-gray-300 p-2 text-sm bg-white"
                  >
                    <option value="completed">Completed (Proceeds to next stage)</option>
                    <option value="adjourned">Adjourned (Postponed / custom reset)</option>
                    <option value="disposed">Disposed (Case successfully closed)</option>
                  </select>
                </div>

                {outcome === "adjourned" && (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Next Hearing Type (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Cross-examination of Plaintiff"
                      value={nextHearingType}
                      onChange={(e) => setNextHearingType(e.target.value)}
                      className="w-full rounded-md border border-gray-300 p-2 text-sm"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700">Court Order / Remarks</label>
                  <textarea
                    placeholder="Enter court orders, summaries or reason for adjournment..."
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-1 focus:ring-[#01411C]"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setOutcomeModalHearing(null)}
                    className="rounded-md border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-[#01411C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#024a23]"
                  >
                    Submit Outcome
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Rescheduling */}
        {rescheduleModalHearing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-gray-100">
              <h3 className="text-lg font-bold text-[#01411C] border-b pb-3 mb-4">Reschedule Hearing</h3>
              
              <form onSubmit={handleRescheduleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700">New Date</label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full rounded-md border border-gray-300 p-2 text-sm"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700">New Time Slot</label>
                  <select
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full rounded-md border border-gray-300 p-2 text-sm bg-white"
                    required
                  >
                    <option value="">Select slot</option>
                    <option value="09:00">09:00 AM - 10:00 AM</option>
                    <option value="10:00">10:00 AM - 11:00 AM</option>
                    <option value="11:00">11:00 AM - 12:00 PM</option>
                    <option value="12:00">12:00 PM - 01:00 PM</option>
                    <option value="14:00">02:00 PM - 03:00 PM</option>
                    <option value="15:00">03:00 PM - 04:00 PM</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700">Court Room</label>
                  <select
                    value={rescheduleRoom}
                    onChange={(e) => setRescheduleRoom(e.target.value)}
                    className="w-full rounded-md border border-gray-300 p-2 text-sm bg-white"
                    required
                  >
                    {courtrooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setRescheduleModalHearing(null)}
                    className="rounded-md border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-[#01411C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#024a23]"
                  >
                    Confirm Reschedule
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </RegistrarLayout>
  );
}
