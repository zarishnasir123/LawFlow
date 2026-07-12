import { apiClient } from "../../../shared/api/axios";

export type ReportedReview = {
  id: string;
  rating: number;
  comment: string | null;
  status: "visible" | "reported" | "hidden";
  reportReason: string | null;
  reportedAt: string | null;
  createdAt: string;
  lawyerName: string;
  clientName: string;
};

// GET /api/admin/reviews?status=reported — the moderation queue.
export async function fetchReportedReviews(
  status: "reported" | "hidden" | "visible" = "reported"
): Promise<ReportedReview[]> {
  const { data } = await apiClient.get<{ reviews: ReportedReview[] }>(
    "/admin/reviews",
    { params: { status } }
  );
  return data.reviews;
}

// Remove the review from public reads + all rating aggregates.
export async function hideReview(reviewId: string): Promise<void> {
  await apiClient.post(`/admin/reviews/${reviewId}/hide`);
}

// Clear the report and restore the review to normal visibility.
export async function dismissReview(reviewId: string): Promise<void> {
  await apiClient.post(`/admin/reviews/${reviewId}/dismiss`);
}

// Suspend the client who posted the review AND hide it.
export async function blockReviewAuthor(reviewId: string): Promise<void> {
  await apiClient.post(`/admin/reviews/${reviewId}/block-user`);
}
