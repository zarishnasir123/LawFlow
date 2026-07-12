import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Flag, Loader2 } from "lucide-react";
import ChatAvatar from "../../../shared/components/ChatAvatar";
import StarRating from "../../../shared/components/StarRating";
import {
  fetchReceivedReviews,
  reportReview,
  type ReceivedReview,
} from "../api/reviews";
import { getApiErrorMessage } from "../../../shared/utils/getApiErrorMessage";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Read-only "My Reviews" block for the lawyer's own profile page: their average
// + the reviews clients left, each with a Report button (→ admin queue).
export default function LawyerReceivedReviews() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["lawyer", "received-reviews"],
    queryFn: fetchReceivedReviews,
  });

  const [reportTarget, setReportTarget] = useState<ReceivedReview | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reportMut = useMutation({
    mutationFn: () => reportReview(reportTarget!.id, reason.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lawyer", "received-reviews"] });
      setReportTarget(null);
      setReason("");
    },
    onError: (e) => setError(getApiErrorMessage(e, "Could not report this review.")),
  });

  const summary = data?.summary;
  const reviews = data?.reviews ?? [];
  const total = summary?.count ?? 0;
  const average = summary?.average ?? null;

  return (
    <div className="pt-6 border-t">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          My Reviews{" "}
          {total > 0 ? (
            <span className="font-normal text-gray-400">({total})</span>
          ) : null}
        </h3>
        {total > 0 && average !== null ? (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <StarRating value={average} size={16} />
            <span className="font-semibold text-gray-900">{average.toFixed(1)}</span>
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-gray-500">Loading your reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">
          You have no reviews yet. Clients can review you after they have a
          submitted case with you.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="flex gap-3">
              <ChatAvatar
                name={r.reviewer.name}
                initials={r.reviewer.initials}
                avatarUrl={r.reviewer.avatarUrl}
                className="h-9 w-9 flex-shrink-0 text-xs"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {r.reviewer.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(r.createdAt)}
                  </span>
                  {r.status === "reported" ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      Reported — under review
                    </span>
                  ) : null}
                </div>
                <StarRating value={r.rating} size={14} className="mt-0.5" />
                {r.comment ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                    {r.comment}
                  </p>
                ) : null}
                {r.status === "visible" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setReason("");
                      setReportTarget(r);
                    }}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-gray-400 transition hover:text-red-500"
                  >
                    <Flag className="h-3 w-3" />
                    Report
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {reportTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Report review</h3>
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Flag this review for an admin to look at. It stays visible until an
              admin decides.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Why are you reporting this? (optional)"
              className="mt-3 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#01411C] focus:ring-2 focus:ring-[#01411C]/20"
            />
            {error ? (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  reportMut.mutate();
                }}
                disabled={reportMut.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {reportMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Flag className="h-4 w-4" />
                )}
                Report
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
