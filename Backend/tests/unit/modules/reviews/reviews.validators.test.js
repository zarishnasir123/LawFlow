import { describe, it, expect } from "vitest";
import { makeReq, runValidators, messagesOf } from "../../../helpers/runValidators.js";
import {
  submitReviewValidator,
  reportReviewValidator,
  reviewIdParamValidator,
} from "../../../../src/modules/reviews/reviews.validators.js";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("submitReviewValidator", () => {
  it("accepts ratings at both boundaries (1 and 5)", async () => {
    for (const rating of ["1", "5"]) {
      const result = await runValidators(
        submitReviewValidator,
        makeReq({ body: { lawyerProfileId: UUID, rating } })
      );
      expect(result.isEmpty(), rating).toBe(true);
    }
  });

  it("rejects ratings outside 1-5 and fractional stars", async () => {
    for (const bad of ["0", "6", "3.5"]) {
      const result = await runValidators(
        submitReviewValidator,
        makeReq({ body: { lawyerProfileId: UUID, rating: bad } })
      );
      expect(messagesOf(result), bad).toContain("rating must be a whole number from 1 to 5");
    }
  });

  it("caps the comment at 1500 characters (optional otherwise)", async () => {
    const result = await runValidators(
      submitReviewValidator,
      makeReq({ body: { lawyerProfileId: UUID, rating: "4", comment: "x".repeat(1501) } })
    );
    expect(messagesOf(result)).toContain("Review is too long (1500 characters max)");
  });
});

describe("reportReviewValidator", () => {
  it("caps the optional reason at 500 characters", async () => {
    const bad = await runValidators(
      reportReviewValidator,
      makeReq({ params: { reviewId: UUID }, body: { reason: "x".repeat(501) } })
    );
    expect(messagesOf(bad)).toContain("Reason is too long (500 characters max)");

    const ok = await runValidators(reportReviewValidator, makeReq({ params: { reviewId: UUID }, body: {} }));
    expect(ok.isEmpty()).toBe(true);
  });
});

describe("reviewIdParamValidator", () => {
  it("requires a UUID review id", async () => {
    const result = await runValidators(reviewIdParamValidator, makeReq({ params: { reviewId: "abc" } }));
    expect(messagesOf(result)).toContain("reviewId must be a valid UUID");
  });
});
