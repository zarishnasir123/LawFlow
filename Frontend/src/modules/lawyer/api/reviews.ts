import { apiClient } from "../../../shared/api/axios";

export type ReceivedReview = {
  id: string;
  rating: number;
  comment: string | null;
  status: "visible" | "reported" | "hidden";
  createdAt: string;
  reviewer: { name: string; initials: string; avatarUrl: string | null };
};

export type ReceivedReviewsResponse = {
  summary: {
    count: number;
    average: number | null;
    distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  };
  reviews: ReceivedReview[];
};

// GET /api/reviews/received — the caller lawyer's own reviews + summary.
export async function fetchReceivedReviews(): Promise<ReceivedReviewsResponse> {
  const { data } = await apiClient.get<ReceivedReviewsResponse>("/reviews/received");
  return data;
}

// POST /api/reviews/:reviewId/report — flag a review of me for admin review.
export async function reportReview(
  reviewId: string,
  reason?: string
): Promise<void> {
  await apiClient.post(`/reviews/${reviewId}/report`, { reason });
}
