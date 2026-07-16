import { describe, it, expect } from "vitest";
import { makeReq, runValidators, messagesOf } from "../../../helpers/runValidators.js";
import {
  caseIdParamValidator,
  listRegistrarCasesValidator,
  returnCaseValidator,
} from "../../../../src/modules/registrarReview/registrarReview.validators.js";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("listRegistrarCasesValidator", () => {
  it("accepts the three listable statuses and no filter", async () => {
    for (const status of ["submitted", "accepted", "returned"]) {
      const result = await runValidators(listRegistrarCasesValidator, makeReq({ query: { status } }));
      expect(result.isEmpty(), status).toBe(true);
    }
    expect((await runValidators(listRegistrarCasesValidator, makeReq())).isEmpty()).toBe(true);
  });

  it("rejects draft (drafts belong to the lawyer, never the registrar)", async () => {
    const result = await runValidators(listRegistrarCasesValidator, makeReq({ query: { status: "draft" } }));
    expect(messagesOf(result)).toContain("status must be one of: submitted, accepted, returned");
  });
});

describe("returnCaseValidator", () => {
  it("requires non-empty remarks", async () => {
    let result = await runValidators(returnCaseValidator, makeReq({ params: { caseId: UUID }, body: {} }));
    expect(messagesOf(result)).toContain("Remarks are required");

    result = await runValidators(
      returnCaseValidator,
      makeReq({ params: { caseId: UUID }, body: { remarks: "   " } })
    );
    expect(messagesOf(result)).toContain("Remarks are required");
  });

  it("caps remarks at 2000 characters", async () => {
    const result = await runValidators(
      returnCaseValidator,
      makeReq({ params: { caseId: UUID }, body: { remarks: "x".repeat(2001) } })
    );
    expect(messagesOf(result)).toContain("Remarks must be 2000 characters or less");
  });

  it("trims the remarks in place so the service stores clean text", async () => {
    const req = makeReq({
      params: { caseId: UUID },
      body: { remarks: "  Missing affidavit annexure.  " },
    });
    const result = await runValidators(returnCaseValidator, req);
    expect(result.isEmpty()).toBe(true);
    expect(req.body.remarks).toBe("Missing affidavit annexure.");
  });
});

describe("caseIdParamValidator", () => {
  it("requires a UUID case id", async () => {
    const result = await runValidators(caseIdParamValidator, makeReq({ params: { caseId: "case-9" } }));
    expect(messagesOf(result)).toContain("caseId must be a valid UUID");
  });
});
