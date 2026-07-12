import { apiClient } from "../../../shared/api/axios";

export type ReviewReviewer = {
  name: string;
  initials: string;
  avatarUrl: string | null;
};

export type LawyerReview = {
  id: string;
  rating: number;
  comment: string | null;
  status: "visible" | "reported" | "hidden";
  createdAt: string;
  isMine: boolean;
  reviewer: ReviewReviewer;
};

export type ReviewSummary = {
  count: number;
  average: number | null;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
};

export type MyReview = {
  id: string;
  rating: number;
  comment: string | null;
  status: string;
  createdAt: string;
};

export type LawyerReviewsResponse = {
  summary: ReviewSummary;
  reviews: LawyerReview[];
  myReview: MyReview | null;
  canReview: boolean;
};

// GET /api/reviews/lawyer/:lawyerProfileId — summary + review list, plus the
// caller's own review and whether they're allowed to write one.
export async function fetchLawyerReviews(
  lawyerProfileId: string
): Promise<LawyerReviewsResponse> {
  const { data } = await apiClient.get<LawyerReviewsResponse>(
    `/reviews/lawyer/${lawyerProfileId}`
  );
  return data;
}

// POST /api/reviews — submit or edit the caller's single review of a lawyer.
export async function submitReview(input: {
  lawyerProfileId: string;
  rating: number;
  comment?: string;
}): Promise<void> {
  await apiClient.post("/reviews", input);
}

// DELETE /api/reviews/:reviewId — remove the caller's own review.
export async function deleteMyReview(reviewId: string): Promise<void> {
  await apiClient.delete(`/reviews/${reviewId}`);
}
