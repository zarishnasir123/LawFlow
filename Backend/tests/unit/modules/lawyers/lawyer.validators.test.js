import { describe, it, expect } from "vitest";
import { makeReq, runValidators, messagesOf } from "../../../helpers/runValidators.js";
import {
  listLawyersValidator,
  getLawyerValidator,
} from "../../../../src/modules/lawyers/lawyer.validators.js";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("listLawyersValidator (public directory filters)", () => {
  it("accepts the known specialization filters including the 'all' sentinel", async () => {
    for (const spec of ["all", "Civil", "Family", "civil", "family"]) {
      const result = await runValidators(listLawyersValidator, makeReq({ query: { specialization: spec } }));
      expect(result.isEmpty(), spec).toBe(true);
    }
  });

  it("rejects unknown specializations", async () => {
    const result = await runValidators(
      listLawyersValidator,
      makeReq({ query: { specialization: "Criminal" } })
    );
    expect(messagesOf(result)).toContain("Specialization must be Civil, Family, or all");
  });

  it("caps the search keyword at 120 characters", async () => {
    const result = await runValidators(listLawyersValidator, makeReq({ query: { search: "x".repeat(121) } }));
    expect(messagesOf(result)).toContain("Search must be 120 characters or less");
  });

  it("bounds pagination like every other list endpoint", async () => {
    const result = await runValidators(listLawyersValidator, makeReq({ query: { limit: "0", offset: "-1" } }));
    const messages = messagesOf(result);
    expect(messages).toContain("Limit must be between 1 and 100");
    expect(messages).toContain("Offset must be zero or a positive integer");
  });
});

describe("getLawyerValidator", () => {
  it("requires a UUID profile id", async () => {
    const bad = await runValidators(getLawyerValidator, makeReq({ params: { lawyerProfileId: "lawyer-7" } }));
    expect(messagesOf(bad)).toContain("Invalid lawyer id");

    const ok = await runValidators(getLawyerValidator, makeReq({ params: { lawyerProfileId: UUID } }));
    expect(ok.isEmpty()).toBe(true);
  });
});
