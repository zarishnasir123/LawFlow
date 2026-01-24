import { ArrowLeft, Calendar, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from "@tanstack/react-router";

export default function ScheduleHearing() {
  const navigate = useNavigate();
  const { caseId } = useParams({ from: '/schedule-hearing/$caseId' });
  const [scheduled, setScheduled] = useState(false);

  if (scheduled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 text-center bg-white rounded-xl shadow-lg border-t-4 border-green-600">
          <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-[#01411C] text-2xl font-bold mb-4">Hearing Scheduled!</h2>
          <p className="text-gray-600 mb-6">The hearing for case <b>{caseId}</b> has been scheduled successfully.</p>
          <button 
            onClick={() => navigate({ to: '/registrar-dashboard' })} 
            className="w-full bg-[#01411C] hover:bg-[#024a23] text-white py-3 rounded-lg font-semibold transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#01411C] text-white py-4 px-6 shadow-md">
        <div className="container mx-auto flex items-center gap-4">
          <button 
            onClick={() => navigate({ to: `/review-cases/$caseId`, params: { caseId } })} 
            className="hover:bg-white/10 p-2 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold">Schedule Hearing</h1>
            <p className="text-sm text-green-100">Case ID: {caseId}</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-white p-8 rounded-xl shadow-sm border">
          <h3 className="text-[#01411C] text-xl font-bold mb-6 border-b pb-2">Hearing Details</h3>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">Hearing Date</label>
                  <input type="date" className="w-full border border-gray-300 rounded-md p-2 focus:ring-1 focus:ring-[#01411C] outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">Hearing Time</label>
                  <input type="time" className="w-full border border-gray-300 rounded-md p-2 focus:ring-1 focus:ring-[#01411C] outline-none" />
                </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 block">Court Room</label>
              <select className="w-full border border-gray-300 rounded-md p-2 focus:ring-1 focus:ring-[#01411C] outline-none bg-white">
                <option value="">Select court room</option>
                <option value="room1">Court Room 1</option>
                <option value="room2">Court Room 2</option>
                <option value="room3">Court Room 3</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 block">Presiding Judge</label>
              <select className="w-full border border-gray-300 rounded-md p-2 focus:ring-1 focus:ring-[#01411C] outline-none bg-white">
                <option value="">Select judge</option>
                <option value="judge1">Hon. Justice Muhammad Iqbal</option>
                <option value="judge2">Hon. Justice Ayesha Malik</option>
              </select>
            </div>

            <div className="space-y-2 pb-4">
              <label className="text-sm font-medium text-gray-700 block">Hearing Type</label>
              <select className="w-full border border-gray-300 rounded-md p-2 focus:ring-1 focus:ring-[#01411C] outline-none bg-white">
                <option value="first">First Hearing</option>
                <option value="final">Final Hearing</option>
              </select>
            </div>

            <button 
              onClick={() => setScheduled(true)} 
              className="w-full bg-[#01411C] hover:bg-[#024a23] text-white py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <Calendar className="h-5 w-5" />
              Confirm & Schedule Hearing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}