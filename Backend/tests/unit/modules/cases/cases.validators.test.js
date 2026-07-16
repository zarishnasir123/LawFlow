import { describe, it, expect } from "vitest";
import { makeReq, runValidators, messagesOf } from "../../../helpers/runValidators.js";
import {
  createCaseValidator,
  caseIdParamValidator,
  caseTypeCodeParamValidator,
  updateCaseValidator,
  attachmentIdParamValidator,
} from "../../../../src/modules/cases/cases.validators.js";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("createCaseValidator", () => {
  const valid = () => ({
    body: {
      caseTypeId: UUID,
      title: "Khan vs Ahmed — property dispute",
      clientName: "Ali Khan",
      oppositePartyName: "Bashir Ahmed",
    },
  });

  it("accepts a minimal valid case", async () => {
    expect((await runValidators(createCaseValidator, makeReq(valid()))).isEmpty()).toBe(true);
  });

  it("requires title, client name, and opposite party name", async () => {
    const result = await runValidators(createCaseValidator, makeReq({ body: { caseTypeId: UUID } }));
    const messages = messagesOf(result);
    expect(messages).toContain("Title is required");
    expect(messages).toContain("Client name is required");
    expect(messages).toContain("Opposite party name is required");
  });

  it("caps the title at 300 characters", async () => {
    const req = makeReq(valid());
    req.body.title = "x".repeat(301);
    expect(messagesOf(await runValidators(createCaseValidator, req))).toContain(
      "Title must be 300 characters or less"
    );
  });

  it("requires a UUID case type", async () => {
    const req = makeReq(valid());
    req.body.caseTypeId = "divorce";
    expect(messagesOf(await runValidators(createCaseValidator, req))).toContain(
      "caseTypeId must be a valid UUID"
    );
  });

  it("only routes to supported tehsils (absent is fine)", async () => {
    let req = makeReq(valid());
    req.body.assignedTehsil = "Lahore";
    expect(messagesOf(await runValidators(createCaseValidator, req))).toContain(
      "Selected court/tehsil is not supported"
    );

    req = makeReq(valid());
    req.body.assignedTehsil = "Kamoke";
    expect((await runValidators(createCaseValidator, req)).isEmpty()).toBe(true);
  });

  it("bounds the optional payment fields", async () => {
    let req = makeReq(valid());
    req.body.agreedTotalAmount = "-5";
    expect(messagesOf(await runValidators(createCaseValidator, req))).toContain(
      "agreedTotalAmount must be a positive number"
    );

    req = makeReq(valid());
    req.body.frequency = "weekly";
    expect(messagesOf(await runValidators(createCaseValidator, req)).join(" ")).toMatch(
      /frequency must be one of/
    );

    req = makeReq(valid());
    req.body.installmentCount = "0";
    expect(messagesOf(await runValidators(createCaseValidator, req))).toContain(
      "installmentCount must be a positive integer"
    );
  });
});

describe("caseTypeCodeParamValidator", () => {
  it("accepts lowercase snake_case codes only", async () => {
    for (const good of ["divorce_papers", "civil_suit", "khula"]) {
      const result = await runValidators(caseTypeCodeParamValidator, makeReq({ params: { code: good } }));
      expect(result.isEmpty(), good).toBe(true);
    }
    for (const bad of ["Divorce-Papers", "ab", "1divorce", "divorce papers"]) {
      const result = await runValidators(caseTypeCodeParamValidator, makeReq({ params: { code: bad } }));
      expect(messagesOf(result), bad).toContain("code must be a lowercase snake_case identifier");
    }
  });
});

describe("updateCaseValidator", () => {
  it("accepts an empty patch (all fields optional)", async () => {
    const result = await runValidators(updateCaseValidator, makeReq({ params: { caseId: UUID }, body: {} }));
    expect(result.isEmpty()).toBe(true);
  });

  it("still enforces the supported-tehsil rule on update", async () => {
    const result = await runValidators(
      updateCaseValidator,
      makeReq({ params: { caseId: UUID }, body: { assignedTehsil: "Karachi" } })
    );
    expect(messagesOf(result)).toContain("Selected court/tehsil is not supported");
  });
});

describe("param validators", () => {
  it("caseIdParamValidator rejects a malformed case id", async () => {
    const result = await runValidators(caseIdParamValidator, makeReq({ params: { caseId: "7" } }));
    expect(messagesOf(result)).toContain("caseId must be a valid UUID");
  });

  it("attachment routes need BOTH ids to be UUIDs", async () => {
    const result = await runValidators(
      attachmentIdParamValidator,
      makeReq({ params: { caseId: UUID, attachmentId: "img.png" } })
    );
    expect(messagesOf(result)).toContain("attachmentId must be a valid UUID");

    const ok = await runValidators(
      attachmentIdParamValidator,
      makeReq({ params: { caseId: UUID, attachmentId: UUID } })
    );
    expect(ok.isEmpty()).toBe(true);
  });
});
