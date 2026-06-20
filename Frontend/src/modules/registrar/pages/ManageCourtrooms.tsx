import { useState, useEffect } from "react";
import RegistrarLayout from "../components/RegistrarLayout";
import Card from "../../../shared/components/dashboard/Card";
import { MapPin, Info } from "lucide-react";
import {
  listCourtrooms,
  getRegistrarErrorMessage,
  type Courtroom
} from "../api";

export default function ManageCourtrooms() {
  const [courtrooms, setCourtrooms] = useState<Courtroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRooms() {
      try {
        setLoading(true);
        setError(null);
        const rooms = await listCourtrooms();
        setCourtrooms(rooms);
      } catch (err) {
        setError(getRegistrarErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    loadRooms();
  }, []);

  return (
    <RegistrarLayout pageSubtitle="Courtrooms" notificationBadge={0}>
      <div className="mx-auto max-w-3xl space-y-6">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#01411C]">Active Courtrooms</h1>
          <p className="text-sm text-gray-500">List of physical courtrooms configured for scheduler dispatching.</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-red-700 border border-red-200 shadow-sm">
            {error}
          </div>
        )}

        <Card className="p-6 border border-gray-100 shadow-sm">
          <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4 text-emerald-800 border border-emerald-100 mb-6">
            <Info className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs">
              Courtrooms are provisioned in the database. The scheduler distributes hearings evenly among these active rooms based on hourly slots.
            </p>
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#01411C] border-t-transparent"></div>
            </div>
          ) : courtrooms.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No courtrooms registered in the database.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {courtrooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-150 bg-white p-4 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[#01411C]">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">{room.name}</h4>
                    <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 mt-1">
                      Active
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </RegistrarLayout>
  );
}
