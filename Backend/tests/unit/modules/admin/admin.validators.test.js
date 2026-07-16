import { describe, it, expect } from "vitest";
import { makeReq, runValidators, messagesOf } from "../../../helpers/runValidators.js";
import {
  statisticsValidator,
  adminCaseIdParamValidator,
  listAdminCasesValidator,
  listPayoutsValidator,
  updatePayoutValidator,
  updateCommissionRateValidator,
  markPayoutPaidValidator,
  disbursePayoutValidator,
  caseTypeIdParamValidator,
  createCaseTypeValidator,
} from "../../../../src/modules/admin/admin.validators.js";
import { ADMIN_CASE_STATUSES } from "../../../../src/modules/admin/adminCases.service.js";
import { CASE_TYPE_CATEGORIES } from "../../../../src/modules/admin/adminCaseTypes.service.js";
import { STATISTICS_RANGES } from "../../../../src/modules/admin/adminStatistics.service.js";
import { PAYOUT_STATUSES } from "../../../../src/modules/payments/payouts.service.js";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("statisticsValidator", () => {
  it("accepts every known range and no range at all", async () => {
    for (const range of STATISTICS_RANGES) {
      const result = await runValidators(statisticsValidator, makeReq({ query: { range } }));
      expect(result.isEmpty(), range).toBe(true);
    }
    expect((await runValidators(statisticsValidator, makeReq())).isEmpty()).toBe(true);
  });

  it("rejects an unknown range", async () => {
    const result = await runValidators(statisticsValidator, makeReq({ query: { range: "decade" } }));
    expect(messagesOf(result).join(" ")).toMatch(/range must be one of/);
  });
});

describe("listAdminCasesValidator", () => {
  it("accepts every lifecycle status and bounds pagination", async () => {
    for (const status of ADMIN_CASE_STATUSES) {
      const result = await runValidators(listAdminCasesValidator, makeReq({ query: { status } }));
      expect(result.isEmpty(), status).toBe(true);
    }

    const bad = await runValidators(
      listAdminCasesValidator,
      makeReq({ query: { status: "archived", limit: "101", offset: "-1" } })
    );
    const messages = messagesOf(bad).join(" ");
    expect(messages).toMatch(/status must be one of/);
    expect(messages).toMatch(/limit must be an integer between 1 and 100/);
    expect(messages).toMatch(/offset must be a non-negative integer/);
  });
});

describe("payout validators", () => {
  it("list filter accepts every real payout status", async () => {
    for (const status of PAYOUT_STATUSES) {
      const result = await runValidators(listPayoutsValidator, makeReq({ query: { status } }));
      expect(result.isEmpty(), status).toBe(true);
    }
    const bad = await runValidators(listPayoutsValidator, makeReq({ query: { status: "pending" } }));
    expect(bad.isEmpty()).toBe(false);
  });

  it("generic PATCH can set processing/failed/cancelled but NEVER paid or requested", async () => {
    for (const status of ["processing", "failed", "cancelled"]) {
      const result = await runValidators(
        updatePayoutValidator,
        makeReq({ params: { payoutId: UUID }, body: { status } })
      );
      expect(result.isEmpty(), status).toBe(true);
    }
    // "paid" must go through mark-paid (which captures transfer proof);
    // "requested" is the lawyer's starting state.
    for (const forbidden of ["paid", "requested"]) {
      const result = await runValidators(
        updatePayoutValidator,
        makeReq({ params: { payoutId: UUID }, body: { status: forbidden } })
      );
      expect(result.isEmpty(), forbidden).toBe(false);
    }
  });

  it("caps the optional note at 2000 characters", async () => {
    const result = await runValidators(
      updatePayoutValidator,
      makeReq({ params: { payoutId: UUID }, body: { status: "failed", note: "x".repeat(2001) } })
    );
    expect(messagesOf(result)).toContain("note is too long");
  });

  it("mark-paid requires the transfer proof fields", async () => {
    const ok = await runValidators(
      markPayoutPaidValidator,
      makeReq({
        params: { payoutId: UUID },
        body: { reference: "TRX-991", transferDate: "2026-07-16", transferBank: "Meezan Bank" },
      })
    );
    expect(ok.isEmpty()).toBe(true);

    const missing = await runValidators(
      markPayoutPaidValidator,
      makeReq({ params: { payoutId: UUID }, body: {} })
    );
    const messages = messagesOf(missing);
    expect(messages).toContain("A bank reference / transaction ID is required");
    expect(messages).toContain("The transfer date is required");
    expect(messages).toContain("The sending bank / method is required");

    const badDate = await runValidators(
      markPayoutPaidValidator,
      makeReq({
        params: { payoutId: UUID },
        body: { reference: "TRX-991", transferDate: "16/07/2026", transferBank: "Meezan Bank" },
      })
    );
    expect(messagesOf(badDate)).toContain("transferDate must be a valid date (YYYY-MM-DD)");
  });

  it("disburse only needs a UUID payout id", async () => {
    const bad = await runValidators(disbursePayoutValidator, makeReq({ params: { payoutId: "p1" } }));
    expect(messagesOf(bad)).toContain("payoutId must be a valid UUID");
  });
});

describe("updateCommissionRateValidator", () => {
  it("accepts 0, 100, and decimals in between (boundaries included)", async () => {
    for (const rate of ["0", "100", "12.5"]) {
      const result = await runValidators(
        updateCommissionRateValidator,
        makeReq({ body: { commissionRate: rate } })
      );
      expect(result.isEmpty(), rate).toBe(true);
    }
  });

  it("rejects missing, negative, and >100 rates", async () => {
    let result = await runValidators(updateCommissionRateValidator, makeReq({ body: {} }));
    expect(messagesOf(result)).toContain("commissionRate is required");

    for (const bad of ["-1", "101", "abc"]) {
      result = await runValidators(
        updateCommissionRateValidator,
        makeReq({ body: { commissionRate: bad } })
      );
      expect(messagesOf(result), bad).toContain("commissionRate must be a number between 0 and 100");
    }
  });
});

describe("case-type validators", () => {
  it("creates only within the supported categories with a capped name", async () => {
    for (const category of CASE_TYPE_CATEGORIES) {
      const result = await runValidators(
        createCaseTypeValidator,
        makeReq({ body: { category, displayName: "Khula Petition" } })
      );
      expect(result.isEmpty(), category).toBe(true);
    }

    const badCat = await runValidators(
      createCaseTypeValidator,
      makeReq({ body: { category: "criminal", displayName: "Bail" } })
    );
    expect(messagesOf(badCat).join(" ")).toMatch(/category must be one of/);

    const noName = await runValidators(
      createCaseTypeValidator,
      makeReq({ body: { category: CASE_TYPE_CATEGORIES[0], displayName: "  " } })
    );
    expect(messagesOf(noName)).toContain("A name for the case type is required");

    const longName = await runValidators(
      createCaseTypeValidator,
      makeReq({ body: { category: CASE_TYPE_CATEGORIES[0], displayName: "x".repeat(201) } })
    );
    expect(messagesOf(longName)).toContain("name is too long (max 200 characters)");
  });

  it("id params must be UUIDs", async () => {
    const badType = await runValidators(caseTypeIdParamValidator, makeReq({ params: { id: "t1" } }));
    expect(messagesOf(badType)).toContain("case type id must be a valid UUID");

    const badCase = await runValidators(adminCaseIdParamValidator, makeReq({ params: { caseId: "c1" } }));
    expect(messagesOf(badCase)).toContain("caseId must be a valid UUID");
  });
});
