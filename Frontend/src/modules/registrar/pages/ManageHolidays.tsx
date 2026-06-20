import { useState, useEffect } from "react";
import RegistrarLayout from "../components/RegistrarLayout";
import Card from "../../../shared/components/dashboard/Card";
import { Calendar, Trash2, Plus, AlertCircle } from "lucide-react";
import {
  listHolidays,
  addHoliday,
  deleteHoliday,
  getRegistrarErrorMessage,
  type Holiday
} from "../api";

export default function ManageHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  const loadHolidays = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listHolidays();
      setHolidays(data);
    } catch (err) {
      setError(getRegistrarErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, []);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !reason.trim()) {
      setError("Please select a date and enter a reason.");
      return;
    }

    try {
      setError(null);
      await addHoliday({ date, reason: reason.trim() });
      setDate("");
      setReason("");
      loadHolidays();
    } catch (err) {
      setError(getRegistrarErrorMessage(err));
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this holiday?")) return;
    try {
      setError(null);
      await deleteHoliday(id);
      loadHolidays();
    } catch (err) {
      setError(getRegistrarErrorMessage(err));
    }
  };

  return (
    <RegistrarLayout pageSubtitle="Manage Holidays" notificationBadge={0}>
      <div className="mx-auto max-w-4xl space-y-6">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#01411C]">Court Holidays Setup</h1>
          <p className="text-sm text-gray-500">Configure public holidays. The auto-scheduler automatically skips these dates when proposing court hearings.</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-red-700 border border-red-200 shadow-sm flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          
          {/* Add Holiday Form */}
          <Card className="p-6 h-fit md:col-span-1 border border-gray-100 shadow-sm">
            <h3 className="text-base font-bold text-[#01411C] border-b pb-2 mb-4 flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              Add Court Holiday
            </h3>

            <form onSubmit={handleAddHoliday} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">Holiday Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-1 focus:ring-[#01411C]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">Reason / Occasion</label>
                <input
                  type="text"
                  placeholder="e.g. Independence Day"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-1 focus:ring-[#01411C]"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 rounded-md bg-[#01411C] py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#024a23]"
              >
                <Calendar className="h-4 w-4" />
                Register Holiday
              </button>
            </form>
          </Card>

          {/* Holidays List */}
          <Card className="p-6 md:col-span-2 border border-gray-100 shadow-sm">
            <h3 className="text-base font-bold text-[#01411C] border-b pb-2 mb-4">
              Registered Holidays Calendar
            </h3>

            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#01411C] border-t-transparent"></div>
              </div>
            ) : holidays.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">No holidays registered in the calendar yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b text-xs font-bold uppercase tracking-wider text-gray-400">
                      <th className="pb-3 w-1/3">Date</th>
                      <th className="pb-3">Reason / Occasion</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.map((holiday) => (
                      <tr key={holiday.id} className="border-b last:border-b-0 hover:bg-gray-50 transition-colors">
                        <td className="py-3 font-semibold text-gray-700 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-emerald-600 shrink-0" />
                          {holiday.date}
                        </td>
                        <td className="py-3 text-gray-600 font-medium">{holiday.reason}</td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleDeleteHoliday(holiday.id)}
                            className="rounded p-1.5 text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete Holiday"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

        </div>

      </div>
    </RegistrarLayout>
  );
}
