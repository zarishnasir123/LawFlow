import { Calendar, CheckCircle, AlertTriangle, Clock, MapPin, Tag } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import RegistrarLayout from "../components/RegistrarLayout";
import Card from "../../../shared/components/dashboard/Card";
import {
  proposeHearing,
  confirmHearing,
  listCourtrooms,
  getRegistrarErrorMessage,
  type Courtroom,
  type HearingProposal
} from "../api";

export default function ScheduleHearing() {
  const navigate = useNavigate();
  const { caseId } = useParams({ from: "/schedule-hearing/$caseId" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Proposal and options state
  const [proposal, setProposal] = useState<HearingProposal | null>(null);
  const [courtrooms, setCourtrooms] = useState<Courtroom[]>([]);
  
  // Form fields
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [courtroomId, setCourtroomId] = useState("");
  const [hearingType, setHearingType] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch proposal and active courtrooms in parallel
        const [propData, rooms] = await Promise.all([
          proposeHearing(caseId),
          listCourtrooms()
        ]);
        
        setProposal(propData);
        setCourtrooms(rooms);

        // Pre-fill form from proposal if available
        if (propData) {
          setHearingType(propData.hearingType || "");
          if (!propData.needsManualScheduling) {
            setDate(propData.hearingDate || "");
            setStartTime(propData.startTime || "");
            setCourtroomId(propData.courtroomId || "");
          }
        }
      } catch (err) {
        setError(getRegistrarErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [caseId]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !startTime || !courtroomId || !hearingType) {
      setError("Please fill out all fields.");
      return;
    }

    try {
      setError(null);
      await confirmHearing(caseId, {
        date,
        startTime,
        courtroomId,
        hearingType
      });
      setSuccess(true);
    } catch (err) {
      setError(getRegistrarErrorMessage(err));
    }
  };

  const isWeekend = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const day = d.getDay();
    return day === 0 || day === 6;
  };

  if (loading) {
    return (
      <RegistrarLayout pageSubtitle="Schedule Hearing" notificationBadge={0}>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#01411C] border-t-transparent"></div>
        </div>
      </RegistrarLayout>
    );
  }

  if (success) {
    return (
      <RegistrarLayout pageSubtitle="Schedule Hearing" notificationBadge={0}>
        <div className="mx-auto max-w-md">
          <Card className="border-t-4 border-[#01411C] p-8 text-center shadow-lg">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="mb-4 text-2xl font-bold text-[#01411C]">Hearing Scheduled</h2>
            <p className="mb-6 text-gray-600">
              The <b>{hearingType}</b> (Hearing #{proposal?.hearingNumber}) has been scheduled successfully.
            </p>
            <button
              onClick={() => navigate({ to: "/registrar-dashboard" })}
              className="w-full rounded-lg bg-[#01411C] py-3 font-semibold text-white transition-colors hover:bg-[#024a23]"
            >
              Back to Dashboard
            </button>
          </Card>
        </div>
      </RegistrarLayout>
    );
  }

  return (
    <RegistrarLayout pageSubtitle="Schedule Hearing" notificationBadge={0}>
      <style>{`
        .hearing-green-select option {
          background-color: #f0fdf4;
          color: #065f46;
        }
        .hearing-green-select option:checked,
        .hearing-green-select option:hover,
        .hearing-green-select option:focus {
          background: linear-gradient(0deg, #dcfce7, #dcfce7);
          color: #065f46;
        }
      `}</style>

      <div className="mx-auto max-w-2xl">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <Card className="p-8 shadow-md">
          <div className="mb-6 flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-xl font-bold text-[#01411C]">Schedule Court Hearing</h3>
              <p className="text-sm text-gray-500 mt-1">Case: {proposal?.caseTitle || "Case Details"}</p>
            </div>
            <span className="rounded bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              Hearing #{proposal?.hearingNumber}
            </span>
          </div>

          {proposal?.needsManualScheduling && (
            <div className="mb-6 rounded-lg bg-amber-50 p-4 border border-amber-200 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-800">Auto-Scheduler Unavailable</h4>
                <p className="text-xs text-amber-700 mt-1">
                  No conflict-free slots were found within the next 60 days. Please coordinate with the lawyer and assign a slot manually below.
                </p>
              </div>
            </div>
          )}

          {!proposal?.needsManualScheduling && (
            <div className="mb-6 rounded-lg bg-emerald-50 p-4 border border-emerald-200 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-emerald-800">Optimal Slot Proposed</h4>
                <p className="text-xs text-emerald-700 mt-1">
                  The auto-scheduler found an open slot matching both courtroom availability and the lawyer's daily calendar rules.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleConfirm} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  Hearing Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 p-2.5 outline-none focus:ring-1 focus:ring-[#01411C]"
                  required
                />
                {isWeekend(date) && (
                  <p className="text-xs text-red-600 font-medium">Warning: Selected date is a weekend.</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-gray-400" />
                  Hearing Time (Hourly Slot)
                </label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="hearing-green-select w-full rounded-md border border-gray-300 bg-white p-2.5 outline-none focus:ring-1 focus:ring-[#01411C]"
                  required
                >
                  <option value="">Select time slot</option>
                  <option value="09:00">09:00 AM - 10:00 AM</option>
                  <option value="10:00">10:00 AM - 11:00 AM</option>
                  <option value="11:00">11:00 AM - 12:00 PM</option>
                  <option value="12:00">12:00 PM - 01:00 PM</option>
                  <option value="14:00">02:00 PM - 03:00 PM</option>
                  <option value="15:00">03:00 PM - 04:00 PM</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-gray-400" />
                Court Room
              </label>
              <select
                value={courtroomId}
                onChange={(e) => setCourtroomId(e.target.value)}
                className="hearing-green-select w-full rounded-md border border-gray-300 bg-white p-2.5 outline-none focus:ring-1 focus:ring-[#01411C]"
                required
              >
                <option value="">Select court room</option>
                {courtrooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 pb-2">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-gray-400" />
                Hearing Type / Stage Name
              </label>
              <input
                type="text"
                value={hearingType}
                onChange={(e) => setHearingType(e.target.value)}
                placeholder="e.g. First Appearance / Summons"
                className="w-full rounded-md border border-gray-300 p-2.5 outline-none focus:ring-1 focus:ring-[#01411C]"
                required
              />
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate({ to: "/registrar-dashboard" })}
                className="w-1/3 rounded-lg border border-gray-300 py-3.5 font-bold text-gray-700 transition-all hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#01411C] py-3.5 font-bold text-white shadow-md transition-all hover:bg-[#024a23]"
              >
                <Calendar className="h-5 w-5" />
                Confirm & Schedule Hearing
              </button>
            </div>
          </form>
        </Card>
      </div>
    </RegistrarLayout>
  );
}
