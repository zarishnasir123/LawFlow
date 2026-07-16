import { describe, it, expect } from "vitest";
import { makeReq, runValidators, messagesOf } from "../../../helpers/runValidators.js";
import {
  createAgreementValidator,
  getAgreementValidator,
  updateAgreementValidator,
  createPaymentPlanValidator,
} from "../../../../src/modules/payments/agreements.validators.js";
import {
  updateServiceChargesValidator,
  getServiceChargesValidator,
} from "../../../../src/modules/payments/serviceCharges.validators.js";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("createAgreementValidator", () => {
  const valid = () => ({
    body: { caseId: UUID, clientUserId: UUID, agreedTotalAmount: "50000" },
  });

  it("accepts a minimal valid agreement", async () => {
    expect((await runValidators(createAgreementValidator, makeReq(valid()))).isEmpty()).toBe(true);
  });

  it("requires a positive total (0 and negative rejected, 0.01 boundary passes)", async () => {
    for (const bad of ["0", "-5000"]) {
      const req = makeReq(valid());
      req.body.agreedTotalAmount = bad;
      expect(messagesOf(await runValidators(createAgreementValidator, req))).toContain(
        "Agreed total amount must be greater than zero"
      );
    }
    const req = makeReq(valid());
    req.body.agreedTotalAmount = "0.01";
    expect((await runValidators(createAgreementValidator, req)).isEmpty()).toBe(true);
  });

  it("only accepts known payment frequencies", async () => {
    const req = makeReq(valid());
    req.body.frequency = "weekly";
    expect(messagesOf(await runValidators(createAgreementValidator, req))).toContain(
      "Invalid payment frequency"
    );
    for (const freq of ["lump_sum", "monthly", "quarterly", "semi_annual"]) {
      const ok = makeReq(valid());
      ok.body.frequency = freq;
      expect((await runValidators(createAgreementValidator, ok)).isEmpty(), freq).toBe(true);
    }
  });

  it("bounds installment count to 1-48", async () => {
    for (const bad of ["0", "49"]) {
      const req = makeReq(valid());
      req.body.installmentCount = bad;
      expect(messagesOf(await runValidators(createAgreementValidator, req))).toContain(
        "Installment count must be between 1 and 48"
      );
    }
    for (const okCount of ["1", "48"]) {
      const req = makeReq(valid());
      req.body.installmentCount = okCount;
      expect((await runValidators(createAgreementValidator, req)).isEmpty(), okCount).toBe(true);
    }
  });

  it("checks each installment row: positive amount + YYYY-MM-DD due date", async () => {
    let req = makeReq(valid());
    req.body.installments = "not-an-array";
    expect(messagesOf(await runValidators(createAgreementValidator, req))).toContain(
      "Installments must be an array"
    );

    req = makeReq(valid());
    req.body.installments = [{ amount: "0", dueDate: "2026-08-01" }];
    expect(messagesOf(await runValidators(createAgreementValidator, req))).toContain(
      "Each installment amount must be greater than zero"
    );

    req = makeReq(valid());
    req.body.installments = [{ amount: "5000", dueDate: "01-08-2026" }];
    expect(messagesOf(await runValidators(createAgreementValidator, req))).toContain(
      "Each installment requires a valid due date (YYYY-MM-DD)"
    );
  });
});

describe("updateAgreementValidator", () => {
  it("accepts known statuses and rejects unknown ones", async () => {
    for (const status of ["draft", "active", "completed", "cancelled"]) {
      const result = await runValidators(
        updateAgreementValidator,
        makeReq({ params: { agreementId: UUID }, body: { status } })
      );
      expect(result.isEmpty(), status).toBe(true);
    }
    const bad = await runValidators(
      updateAgreementValidator,
      makeReq({ params: { agreementId: UUID }, body: { status: "paused" } })
    );
    expect(messagesOf(bad)).toContain("Invalid agreement status");
  });
});

describe("createPaymentPlanValidator", () => {
  it("requires a positive total and a 1-48 installment count", async () => {
    const ok = await runValidators(
      createPaymentPlanValidator,
      makeReq({ params: { caseId: UUID }, body: { totalAmount: "100000", installmentCount: "12" } })
    );
    expect(ok.isEmpty()).toBe(true);

    const zeroTotal = await runValidators(
      createPaymentPlanValidator,
      makeReq({ params: { caseId: UUID }, body: { totalAmount: "0", installmentCount: "12" } })
    );
    expect(messagesOf(zeroTotal)).toContain("Total amount must be greater than zero");

    const badCount = await runValidators(
      createPaymentPlanValidator,
      makeReq({ params: { caseId: UUID }, body: { totalAmount: "100000", installmentCount: "49" } })
    );
    expect(messagesOf(badCount)).toContain("Installment count must be between 1 and 48");
  });

  it("validates custom due dates when a schedule is sent", async () => {
    const result = await runValidators(
      createPaymentPlanValidator,
      makeReq({
        params: { caseId: UUID },
        body: {
          totalAmount: "100000",
          installmentCount: "2",
          installments: [{ dueDate: "2026/08/01" }],
        },
      })
    );
    expect(messagesOf(result)).toContain("Each installment requires a valid due date (YYYY-MM-DD)");
  });
});

describe("updateServiceChargesValidator", () => {
  it("requires at least one fee", async () => {
    const result = await runValidators(updateServiceChargesValidator, makeReq({ body: {} }));
    expect(messagesOf(result)).toContain("At least one of familyCaseFee or civilCaseFee is required");
  });

  it("accepts one or both positive fees", async () => {
    expect(
      (await runValidators(updateServiceChargesValidator, makeReq({ body: { familyCaseFee: "5000" } }))).isEmpty()
    ).toBe(true);
    expect(
      (
        await runValidators(
          updateServiceChargesValidator,
          makeReq({ body: { familyCaseFee: "5000", civilCaseFee: "7000" } })
        )
      ).isEmpty()
    ).toBe(true);
  });

  it("rejects zero or negative fees", async () => {
    let result = await runValidators(updateServiceChargesValidator, makeReq({ body: { familyCaseFee: "0" } }));
    expect(messagesOf(result)).toContain("Family case fee must be greater than zero");
    result = await runValidators(updateServiceChargesValidator, makeReq({ body: { civilCaseFee: "-100" } }));
    expect(messagesOf(result)).toContain("Civil case fee must be greater than zero");
  });
});

describe("UUID param validators (agreements + charges)", () => {
  it("reject malformed ids and accept real UUIDs", async () => {
    const bad = await runValidators(getAgreementValidator, makeReq({ params: { agreementId: "1" } }));
    expect(messagesOf(bad)).toContain("Invalid agreement ID format");

    const ok = await runValidators(getServiceChargesValidator, makeReq({ params: { lawyerProfileId: UUID } }));
    expect(ok.isEmpty()).toBe(true);
  });
});
