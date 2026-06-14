import type { PendingLawyer } from "../api/lawyerVerifications";
import { formatRelativeTime } from "../../../shared/utils/relativeTime";

type Props = {
  items: PendingLawyer[];
  onViewAll: () => void;
  onReview: (item: PendingLawyer) => void;
  isLoading?: boolean;
  title?: string;
};

function lawyerDisplayName(lawyer: PendingLawyer) {
  return (
    [lawyer.firstName, lawyer.lastName].filter(Boolean).join(" ") || lawyer.email
  );
}

export function PendingVerificationList({
  items,
  onViewAll,
  onReview,
  isLoading = false,
  title = "Recent Verification Requests",
}: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-gray-900">{title}</h3>

        <button
          onClick={onViewAll}
          className="text-[#01411C] hover:bg-green-50 px-3 py-2 rounded-lg text-sm"
          type="button"
        >
          View All
        </button>
      </div>

      {isLoading ? (
        <PendingVerificationSkeleton />
      ) : items.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
          No recent verification requests.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((v) => (
            <div
              key={v.lawyerProfileId}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-gray-900 truncate">
                    {lawyerDisplayName(v)}
                  </h4>
                  <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    Lawyer
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-1 truncate" title={v.email}>
                  {v.email}
                </p>
                <p className="text-xs text-gray-500">
                  {formatRelativeTime(v.submittedAt)}
                </p>
              </div>

              <button
                onClick={() => onReview(v)}
                className="bg-[#01411C] hover:bg-[#024a23] text-white px-3 py-2 rounded-lg text-sm shrink-0"
                type="button"
              >
                Review
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Subtle shimmer placeholders that preserve the row layout while loading.
function PendingVerificationSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg animate-pulse"
        >
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-gray-200" />
            <div className="h-3 w-1/2 rounded bg-gray-200" />
            <div className="h-3 w-1/4 rounded bg-gray-200" />
          </div>
          <div className="h-9 w-16 rounded-lg bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
