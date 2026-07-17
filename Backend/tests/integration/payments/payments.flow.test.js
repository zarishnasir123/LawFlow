import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";

// Fake the Safepay SDK — the only piece of the money chain we do not run
// for real. Everything else (agreements, installments, transactions,
// commission split, payouts) runs against the real test database.
let tokenSeq = 1;
vi.mock("@sfpy/node-sdk", () => ({
  Safepay: class {
    constructor() {
      this.payments = { create: async () => ({ token: `trk_test_${tokenSeq++}` }) };
      this.checkout = { create: () => "https://sandbox.api.getsafepay.com/checkout/test" };
      this.verify = { signature: () => true, webhook: () => true };
    }
  },
}));

const { default: app } = await import("../../../src/app.js");
const { pool } = await import("../../../src/config/db.js");
const { recordPaymentByToken } = await import(
  "../../../src/modules/payments/payments.controller.js"
);
const { resetDb, closePool } = await import("../../helpers/testDb.js");
const { createClient, createLawyer, createCase } = await import("../../helpers/factories.js");
const { authHeader } = await import("../../helpers/auth.js");

beforeEach(resetDb);
afterAll(closePool);

// Build the full chain up to a checkout-ready installment:
// lawyer + client + case → payment plan via the API → client checkout.
async function checkoutReady({ totalAmount = 90_000, installmentCount = 3 } = {}) {
  const lawyer = await createLawyer();
  const client = await createClient();
  const caseRow = await createCase({
    lawyer,
    clientUserId: client.id,
    assignedTehsil: "Gujranwala",
  });

  // Business rule: a lawyer must publish service charges before payment plans.
  await request(app)
    .put("/api/payments/service-charges")
    .set(authHeader(lawyer))
    .send({ civilCaseFee: totalAmount, familyCaseFee: totalAmount });

  const plan = await request(app)
    .post(`/api/payments/lawyer/cases/${caseRow.id}/payment-plan`)
    .set(authHeader(lawyer))
    .send({ totalAmount, installmentCount });
  expect(plan.status, JSON.stringify(plan.body)).toBeLessThan(300);

  const { rows: installments } = await pool.query(
    `SELECT i.* FROM installments i
     JOIN agreements a ON a.id = i.agreement_id
     WHERE a.case_id = $1
     ORDER BY i.due_date`,
    [caseRow.id]
  );
  return { lawyer, client, caseRow, installments };
}

async function startCheckout(client, installment, caseName = "Khan vs Ahmed") {
  const res = await request(app)
    .post("/api/payments/create-checkout-session")
    .set(authHeader(client))
    .send({ installmentId: installment.id, amount: Number(installment.amount), caseName });
  return res;
}

const txnCountFor = async (caseId) =>
  (
    await pool.query(`SELECT COUNT(*)::int AS count FROM payment_transactions WHERE case_id = $1`, [
      caseId,
    ])
  ).rows[0].count;

describe("payment plan", () => {
  it("creates installments that sum exactly to the agreed total", async () => {
    const { installments } = await checkoutReady({ totalAmount: 100_000, installmentCount: 3 });
    expect(installments).toHaveLength(3);
    const sum = installments.reduce((acc, i) => acc + Number(i.amount), 0);
    expect(sum).toBe(100_000);
  });
});

describe("checkout", () => {
  it("stores the gateway token on the installment and returns a checkout URL", async () => {
    const { client, installments } = await checkoutReady();
    const res = await startCheckout(client, installments[0]);
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);

    const { rows } = await pool.query(`SELECT gateway_checkout_token FROM installments WHERE id = $1`, [
      installments[0].id,
    ]);
    expect(rows[0].gateway_checkout_token).toMatch(/^trk_test_/);
  });

  it("rejects a checkout whose amount does not match the installment", async () => {
    const { client, installments } = await checkoutReady();
    const res = await request(app)
      .post("/api/payments/create-checkout-session")
      .set(authHeader(client))
      .send({ installmentId: installments[0].id, amount: 1, caseName: "X" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not match/i);
  });

  it("refuses to start checkout on an already-paid installment", async () => {
    const { client, caseRow, installments } = await checkoutReady();
    await startCheckout(client, installments[0]);
    const { rows } = await pool.query(`SELECT gateway_checkout_token FROM installments WHERE id = $1`, [
      installments[0].id,
    ]);
    await recordPaymentByToken({ checkoutToken: rows[0].gateway_checkout_token, gatewayReference: "ref-1" });
    expect(await txnCountFor(caseRow.id)).toBe(1);

    const again = await startCheckout(client, { ...installments[0], amount: installments[0].amount });
    expect(again.status).toBe(409);
  });
});

describe("payment recording (the money must never double-count)", () => {
  async function paidOnce() {
    const ctx = await checkoutReady({ totalAmount: 90_000, installmentCount: 3 });
    await startCheckout(ctx.client, ctx.installments[0]);
    const { rows } = await pool.query(`SELECT gateway_checkout_token FROM installments WHERE id = $1`, [
      ctx.installments[0].id,
    ]);
    return { ...ctx, token: rows[0].gateway_checkout_token };
  }

  it("records the transaction with the 10% commission split and marks the installment paid", async () => {
    const { caseRow, token, installments } = await paidOnce();
    const result = await recordPaymentByToken({ checkoutToken: token, gatewayReference: "ref-1" });
    expect(result.duplicate ?? false).toBe(false);

    const { rows: txns } = await pool.query(
      `SELECT amount, platform_fee_amount, lawyer_net_amount, status
       FROM payment_transactions WHERE case_id = $1`,
      [caseRow.id]
    );
    expect(txns).toHaveLength(1);
    expect(txns[0].status).toBe("success");
    expect(Number(txns[0].amount)).toBe(30_000);
    expect(Number(txns[0].platform_fee_amount)).toBe(3_000); // 10% commission
    expect(Number(txns[0].lawyer_net_amount)).toBe(27_000); // lawyer's 90%

    const { rows } = await pool.query(`SELECT status FROM installments WHERE id = $1`, [
      installments[0].id,
    ]);
    expect(rows[0].status).toBe("paid");
  });

  it("ignores the same gateway event delivered twice (sequential webhook retry)", async () => {
    const { caseRow, token } = await paidOnce();
    await recordPaymentByToken({ checkoutToken: token, gatewayReference: "ref-1" });
    const second = await recordPaymentByToken({ checkoutToken: token, gatewayReference: "ref-1" });
    expect(second.duplicate).toBe(true);
    expect(await txnCountFor(caseRow.id)).toBe(1);
  });

  it("survives the confirm call and webhook racing each other (concurrent duplicate)", async () => {
    const { caseRow, token } = await paidOnce();
    await Promise.all([
      recordPaymentByToken({ checkoutToken: token, gatewayReference: "ref-race" }),
      recordPaymentByToken({ checkoutToken: token, gatewayReference: "ref-race" }),
    ]);
    expect(await txnCountFor(caseRow.id)).toBe(1);
  });
});

describe("lawyer payouts", () => {
  async function lawyerWithEarnings() {
    const ctx = await checkoutReady({ totalAmount: 90_000, installmentCount: 3 });
    await startCheckout(ctx.client, ctx.installments[0]);
    const { rows } = await pool.query(`SELECT gateway_checkout_token FROM installments WHERE id = $1`, [
      ctx.installments[0].id,
    ]);
    await recordPaymentByToken({ checkoutToken: rows[0].gateway_checkout_token, gatewayReference: "r" });

    await request(app)
      .put("/api/payments/lawyer/payout-account")
      .set(authHeader(ctx.lawyer))
      .send({ accountTitle: "Zarish Nasir", accountNumber: "PK00MEZN0000001", bankName: "Meezan Bank" });
    return ctx;
  }

  it("lets the lawyer withdraw exactly their net balance (not the gross)", async () => {
    const { lawyer } = await lawyerWithEarnings();
    const res = await request(app)
      .post("/api/payments/lawyer/request-payout")
      .set(authHeader(lawyer));
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);

    const { rows } = await pool.query(`SELECT amount, status FROM payouts WHERE lawyer_user_id = $1`, [
      lawyer.id,
    ]);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].amount)).toBe(27_000); // net of 10% commission
    expect(rows[0].status).toBe("requested");
  });

  it("refuses a payout without a bank account on file", async () => {
    const lawyer = await createLawyer();
    const res = await request(app)
      .post("/api/payments/lawyer/request-payout")
      .set(authHeader(lawyer));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/payout bank account/i);
  });

  it("refuses a second request while one is still open", async () => {
    const { lawyer } = await lawyerWithEarnings();
    await request(app).post("/api/payments/lawyer/request-payout").set(authHeader(lawyer));
    const second = await request(app)
      .post("/api/payments/lawyer/request-payout")
      .set(authHeader(lawyer));
    expect(second.status).toBe(409);
  });

  it("two simultaneous withdraw clicks create exactly ONE payout (advisory lock)", async () => {
    const { lawyer } = await lawyerWithEarnings();
    await Promise.all([
      request(app).post("/api/payments/lawyer/request-payout").set(authHeader(lawyer)),
      request(app).post("/api/payments/lawyer/request-payout").set(authHeader(lawyer)),
    ]);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM payouts WHERE lawyer_user_id = $1`,
      [lawyer.id]
    );
    expect(rows[0].count).toBe(1);
  });

  it("refuses to withdraw when nothing has been earned", async () => {
    const lawyer = await createLawyer();
    await request(app)
      .put("/api/payments/lawyer/payout-account")
      .set(authHeader(lawyer))
      .send({ accountTitle: "T", accountNumber: "PK00", bankName: "Meezan" });
    const res = await request(app)
      .post("/api/payments/lawyer/request-payout")
      .set(authHeader(lawyer));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/balance/i);
  });
});
