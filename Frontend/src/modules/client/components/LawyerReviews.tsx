import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, X, Loader2, Trash2, PenLine } from "lucide-react";
import ChatAvatar from "../../../shared/components/ChatAvatar";
import StarRating from "../../../shared/components/StarRating";
import {
  fetchLawyerReviews,
  submitReview,
  deleteMyReview,
} from "../api/reviews";
import { getApiErrorMessage } from "../../../shared/utils/getApiErrorMessage";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface LawyerReviewsProps {
  lawyerProfileId: string;
  lawyerName: string;
}

export default function LawyerReviews({
  lawyerProfileId,
  lawyerName,
}: LawyerReviewsProps) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["lawyer-reviews", lawyerProfileId],
    queryFn: () => fetchLawyerReviews(lawyerProfileId),
    enabled: Boolean(lawyerProfileId),
  });

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const submitMut = useMutation({
    mutationFn: () =>
      submitReview({
        lawyerProfileId,
        rating,
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lawyer-reviews", lawyerProfileId] });
      qc.invalidateQueries({ queryKey: ["lawyer", lawyerProfileId] });
      setOpen(false);
    },
    onError: (e) => setError(getApiErrorMessage(e, "Could not submit your review.")),
  });

  const deleteMut = useMutation({
    mutationFn: (reviewId: string) => deleteMyReview(reviewId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lawyer-reviews", lawyerProfileId] });
      qc.invalidateQueries({ queryKey: ["lawyer", lawyerProfileId] });
    },
  });

  const openModal = () => {
    setError(null);
    setRating(data?.myReview?.rating || 0);
    setComment(data?.myReview?.comment || "");
    setOpen(true);
  };

  const summary = data?.summary;
  const reviews = data?.reviews ?? [];
  const total = summary?.count ?? 0;
  const average = summary?.average ?? null;
  const myReview = data?.myReview ?? null;
  const canReview = data?.canReview ?? false;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Reviews {total > 0 ? <span className="text-gray-400">({total})</span> : null}
        </h2>
        {myReview ? (
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-[#01411C] hover:text-[#01411C]"
          >
            <PenLine className="h-3.5 w-3.5" />
            Edit your review
          </button>
        ) : canReview ? (
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#01411C] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#024a23]"
          >
            <Star className="h-3.5 w-3.5" />
            Write a review
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-gray-500">Loading reviews…</p>
      ) : (
        <>
          {/* Summary — average + distribution */}
          {total > 0 && average !== null ? (
            <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex flex-col items-center justify-center rounded-xl bg-gray-50/70 px-6 py-4">
                <span className="text-3xl font-bold text-gray-900">
                  {average.toFixed(1)}
                </span>
                <StarRating value={average} size={16} className="mt-1" />
                <span className="mt-1 text-xs text-gray-500">
                  {total} review{total === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex-1 space-y-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = summary?.distribution[star as 1 | 2 | 3 | 4 | 5] ?? 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-gray-500">{star}</span>
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-amber-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-gray-400">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              {lawyerName} has no reviews yet.
              {!myReview && !canReview
                ? " Only clients who have a submitted case with this lawyer can review them."
                : ""}
            </p>
          )}

          {/* Review list */}
          {reviews.length > 0 ? (
            <ul className="mt-5 space-y-4 border-t border-gray-100 pt-5">
              {(showAll ? reviews : reviews.slice(0, 3)).map((r) => (
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
                      {r.isMine ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                          Your review
                        </span>
                      ) : null}
                      <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                    </div>
                    <StarRating value={r.rating} size={14} className="mt-0.5" />
                    {r.comment ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                        {r.comment}
                      </p>
                    ) : null}
                    {r.isMine ? (
                      <button
                        type="button"
                        onClick={() => deleteMut.mutate(r.id)}
                        disabled={deleteMut.isPending}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-gray-400 transition hover:text-red-500 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {reviews.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-4 w-full rounded-lg border border-gray-200 py-2 text-xs font-semibold text-gray-600 transition hover:border-[#01411C] hover:text-[#01411C]"
            >
              {showAll ? "Show less" : `Show all ${reviews.length} reviews`}
            </button>
          ) : null}
        </>
      )}

      {/* Write / edit modal */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                {myReview ? "Edit your review" : "Write a review"}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">Reviewing {lawyerName}</p>

            <div className="mt-4">
              <p className="mb-1 text-sm font-medium text-gray-700">Your rating</p>
              <StarRating value={rating} onChange={setRating} size={28} />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Your review <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                maxLength={1500}
                placeholder="Share your experience working with this lawyer…"
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#01411C] focus:ring-2 focus:ring-[#01411C]/20"
              />
            </div>

            {error ? (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  submitMut.mutate();
                }}
                disabled={rating === 0 || submitMut.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#024a23] disabled:opacity-50"
              >
                {submitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {myReview ? "Update review" : "Post review"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
