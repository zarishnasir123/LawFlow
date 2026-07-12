import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, EyeOff, Check, UserX } from "lucide-react";

import {
  fetchReportedReviews,
  hideReview,
  dismissReview,
  blockReviewAuthor,
} from "../api/reviews";
import StatusToast from "../components/modals/StatusToast";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"
          }`}
        />
      ))}
    </span>
  );
}

type Toast = {
  open: boolean;
  type: "success" | "error";
  title: string;
  message?: string;
};

export default function ReviewsModeration() {
  const qc = useQueryClient();
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["admin", "reported-reviews"],
    queryFn: () => fetchReportedReviews("reported"),
  });

  const [toast, setToast] = useState<Toast>({
    open: false,
    type: "success",
    title: "",
  });
  const [confirmBlock, setConfirmBlock] = useState<string | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "reported-reviews"] });
  const showToast = (
    type: "success" | "error",
    title: string,
    message?: string
  ) => setToast({ open: true, type, title, message });

  const hideMut = useMutation({
    mutationFn: hideReview,
    onSuccess: () => {
      invalidate();
      showToast("success", "Review removed");
    },
    onError: () => showToast("error", "Could not remove the review"),
  });
  const dismissMut = useMutation({
    mutationFn: dismissReview,
    onSuccess: () => {
      invalidate();
      showToast("success", "Report dismissed");
    },
    onError: () => showToast("error", "Could not dismiss the report"),
  });
  const blockMut = useMutation({
    mutationFn: blockReviewAuthor,
    onSuccess: () => {
      invalidate();
      setConfirmBlock(null);
      showToast(
        "success",
        "Client blocked",
        "Their account is suspended and the review removed."
      );
    },
    onError: () => showToast("error", "Could not block the client"),
  });

  const busy = hideMut.isPending || dismissMut.isPending || blockMut.isPending;

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Review Moderation</h1>
        <p className="mt-1 text-sm text-gray-500">
          Reviews a lawyer has reported. Remove abusive ones, block the client
          who posted hate comments, or dismiss the report if it's fine.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          No reported reviews right now.
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  <span className="font-semibold text-gray-900">
                    {r.clientName}
                  </span>{" "}
                  <span className="text-gray-400">reviewed</span>{" "}
                  <span className="font-semibold text-gray-900">
                    {r.lawyerName}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <Stars rating={r.rating} />
                  <span className="text-xs text-gray-400">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {r.comment ? (
                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  {r.comment}
                </p>
              ) : (
                <p className="mt-3 text-sm italic text-gray-400">
                  No written comment.
                </p>
              )}

              {r.reportReason ? (
                <p className="mt-2 text-xs text-amber-700">
                  <span className="font-semibold">Report reason:</span>{" "}
                  {r.reportReason}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => hideMut.mutate(r.id)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  Remove review
                </button>
                <button
                  type="button"
                  onClick={() => dismissMut.mutate(r.id)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  Dismiss report
                </button>

                {confirmBlock === r.id ? (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">
                    Block this client &amp; remove the review?
                    <button
                      type="button"
                      onClick={() => blockMut.mutate(r.id)}
                      disabled={busy}
                      className="rounded bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Yes, block
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmBlock(null)}
                      className="rounded px-2 py-1 font-medium text-gray-600 hover:bg-white"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmBlock(r.id)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <UserX className="h-3.5 w-3.5" />
                    Block user
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <StatusToast
        open={toast.open}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </div>
  );
}
