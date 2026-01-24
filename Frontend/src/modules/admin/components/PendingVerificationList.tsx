import type { PendingVerification } from "../types";

type Props = {
  items: PendingVerification[];
  onViewAll: () => void;
  onReview: (item: PendingVerification) => void;
};

export function PendingVerificationList({ items, onViewAll, onReview }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-gray-900">Recent Verification Requests</h3>

        <button
          onClick={onViewAll}
          className="text-[#01411C] hover:bg-green-50 px-3 py-2 rounded-lg text-sm"
          type="button"
        >
          View All
        </button>
      </div>

      <div className="space-y-4">
        {items.map((v) => (
          <div key={v.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-gray-900">{v.name}</h4>
                <span
                  className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    v.type === "Lawyer"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {v.type}
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-1">{v.email}</p>
              <p className="text-xs text-gray-500">{v.submitted}</p>
            </div>

            <button
              onClick={() => onReview(v)}
              className="bg-[#01411C] hover:bg-[#024a23] text-white px-3 py-2 rounded-lg text-sm"
              type="button"
            >
              Review
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
