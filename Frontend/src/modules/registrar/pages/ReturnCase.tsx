import { XCircle } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export default function ReturnCase() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-10 rounded-xl shadow-lg border border-red-100 text-center max-w-sm w-full">
        <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto mb-6">
          <XCircle className="h-12 w-12" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Case Returned</h2>
        <p className="text-gray-500 mb-8">
          Sent back to the lawyer with your instructions for corrections.
        </p>
        <button
          onClick={() => navigate({ to: "/registrar-dashboard" })}
          className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}