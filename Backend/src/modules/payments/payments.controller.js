import { Safepay } from "@sfpy/node-sdk";
import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import { isValidUuid } from "../../utils/uuid.js";
import { getInstallmentForCheckout } from "./agreements.service.js";
import { generateReceiptNumber } from "./transactions.service.js";

// Safepay (Pakistani gateway) replaces Stripe. We run in SANDBOX for the
// project — real production payments require State-Bank merchant onboarding.
// The client guard mirrors the old Stripe behaviour: when the keys aren't set
// the payment endpoints answer 503 instead of crashing.
// The Safepay SDK constructor throws unless environment, apiKey, v1Secret AND
// webhookSecret are ALL present — so we guard on all three and wrap in try/catch
// so a missing/blank key can never crash app startup. When unconfigured, the
// payment endpoints answer 503 instead.
function initSafepay() {
  const { SAFEPAY_API_KEY, SAFEPAY_SECRET_KEY, SAFEPAY_WEBHOOK_SECRET } = process.env;
  if (!SAFEPAY_API_KEY || !SAFEPAY_SECRET_KEY || !SAFEPAY_WEBHOOK_SECRET) {
    return null;
  }
  try {
    return new Safepay({
      environment: process.env.SAFEPAY_ENVIRONMENT || "sandbox",
      apiKey: SAFEPAY_API_KEY,
      v1Secret: SAFEPAY_SECRET_KEY,
      webhookSecret: SAFEPAY_WEBHOOK_SECRET,
    });
  } catch (error) {
    console.error("Safepay init failed:", error?.message || error);
    return null;
  }
}

const safepay = initSafepay();

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function frontendBaseUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
}

// Public HTTPS base Safepay can reach for the return + webhook calls. In dev
// this is an ngrok tunnel to the backend; in prod it's the real API domain.
// Safepay cannot call `localhost`, which is why this is separate from
// FRONTEND_URL (the browser redirect target, which may stay on localhost).
function publicApiBaseUrl() {
  return (process.env.PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");
}

/**
 * Records a completed payment, keyed by the Safepay checkout token we stored on
 * the installment at create-time. Everything (case, client, agreement, amount)
 * is derived from our own DB via that token — we never trust gateway-sent
 * amounts or ids. Idempotent: the UNIQUE gateway_checkout_token + the FOR UPDATE
 * lock make a double-fire (return path AND webhook) harmless.
 *
 * Returns { duplicate, caseId, transactionId, receiptNumber } or null when the
 * token maps to no installment.
 */
async function recordPaymentByToken({ checkoutToken, gatewayReference }) {
  if (!checkoutToken) return null;

  const dbClient = await pool.connect();
  try {
    await dbClient.query("BEGIN");

    const existingTxn = await dbClient.query(
      `SELECT id, case_id FROM payment_transactions
       WHERE gateway_checkout_token = $1`,
      [checkoutToken]
    );
    if (existingTxn.rows.length > 0) {
      await dbClient.query("COMMIT");
      return {
        duplicate: true,
        transactionId: existingTxn.rows[0].id,
        caseId: existingTxn.rows[0].case_id,
      };
    }

    const installmentResult = await dbClient.query(
      `SELECT
         i.id AS installment_id,
         i.amount,
         i.status,
         a.id AS agreement_id,
         a.case_id,
         a.client_user_id,
         a.lawyer_user_id
       FROM installments i
       INNER JOIN agreements a ON a.id = i.agreement_id
       WHERE i.gateway_checkout_token = $1
       FOR UPDATE OF i`,
      [checkoutToken]
    );

    if (installmentResult.rows.length === 0) {
      await dbClient.query("ROLLBACK");
      return null;
    }

    const row = installmentResult.rows[0];
    const amount = roundMoney(row.amount);

    if (row.status !== "paid") {
      await dbClient.query(
        `UPDATE installments
         SET status = 'paid', paid_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [row.installment_id]
      );
    }

    const txnResult = await dbClient.query(
      `INSERT INTO payment_transactions (
        installment_id,
        agreement_id,
        case_id,
        client_user_id,
        lawyer_user_id,
        amount,
        currency,
        status,
        gateway,
        gateway_checkout_token,
        gateway_reference
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'PKR', 'success', 'safepay', $7, $8)
      RETURNING *`,
      [
        row.installment_id,
        row.agreement_id,
        row.case_id,
        row.client_user_id,
        row.lawyer_user_id,
        amount,
        checkoutToken,
        gatewayReference || null,
      ]
    );

    const transaction = txnResult.rows[0];
    const receiptNumber = await generateReceiptNumber(dbClient);

    await dbClient.query(
      `INSERT INTO payment_receipts (
        transaction_id,
        receipt_number,
        installment_id,
        agreement_id,
        case_id,
        client_user_id,
        lawyer_user_id,
        amount,
        currency,
        payment_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PKR', 'paid')`,
      [
        transaction.id,
        receiptNumber,
        row.installment_id,
        row.agreement_id,
        row.case_id,
        row.client_user_id,
        row.lawyer_user_id,
        amount,
      ]
    );

    const paidCount = await dbClient.query(
      `SELECT COUNT(*)::int AS count
       FROM installments
       WHERE agreement_id = $1 AND status = 'paid'`,
      [row.agreement_id]
    );
    const totalCount = await dbClient.query(
      `SELECT COUNT(*)::int AS count FROM installments WHERE agreement_id = $1`,
      [row.agreement_id]
    );

    if (
      totalCount.rows[0].count > 0 &&
      paidCount.rows[0].count === totalCount.rows[0].count
    ) {
      await dbClient.query(
        `UPDATE agreements SET status = 'completed', updated_at = NOW() WHERE id = $1`,
        [row.agreement_id]
      );
    }

    await dbClient.query("COMMIT");
    return {
      duplicate: false,
      transactionId: transaction.id,
      receiptNumber,
      caseId: row.case_id,
    };
  } catch (error) {
    await dbClient.query("ROLLBACK");
    throw error;
  } finally {
    dbClient.release();
  }
}

/**
 * POST /api/payments/create-checkout-session  (client)
 * Validates the installment, opens a Safepay checkout, stores the checkout
 * token on the installment, and returns the hosted checkout URL to redirect to.
 */
export async function createCheckoutSession(req, res) {
  const { installmentId, amount, caseName } = req.body;
  const userId = req.user.sub;
  const role = req.user.role;

  if (!installmentId || amount === undefined || !caseName) {
    return res.status(400).json({
      message: "Missing required fields: installmentId, amount, caseName",
    });
  }

  if (!isValidUuid(installmentId)) {
    return res.status(400).json({ message: "Invalid installment ID" });
  }

  const parsedAmount = roundMoney(amount);
  if (parsedAmount <= 0) {
    return res.status(400).json({ message: "Amount must be greater than zero" });
  }

  if (!safepay) {
    return res.status(503).json({ message: "Payment service is not configured" });
  }

  try {
    const installment = await getInstallmentForCheckout(
      installmentId,
      userId,
      role
    );

    if (installment.status === "paid") {
      return res.status(409).json({ message: "Installment is already paid" });
    }

    if (installment.status === "cancelled") {
      return res.status(410).json({ message: "Installment is cancelled" });
    }

    if (parsedAmount !== roundMoney(installment.amount)) {
      return res.status(400).json({ message: "Amount does not match installment" });
    }

    const currency = (process.env.SAFEPAY_CURRENCY || "PKR").toUpperCase();

    // Safepay amounts are in the lowest denomination (paisa for PKR), same
    // convention Stripe used. (Verify once against the sandbox dashboard.)
    const { token } = await safepay.payments.create({
      amount: Math.round(parsedAmount * 100),
      currency,
    });

    // Safepay calls these back over HTTPS — they must point at the backend's
    // public URL (ngrok in dev), not the SPA. The backend records the payment
    // then redirects the browser on to the SPA.
    const apiBase = publicApiBaseUrl();
    const checkoutUrl = safepay.checkout.create({
      token,
      orderId: installmentId,
      redirectUrl: `${apiBase}/api/payments/safepay/return`,
      cancelUrl: `${apiBase}/api/payments/safepay/cancel?caseId=${installment.case_id}`,
      source: "custom",
      webhooks: true,
    });

    await pool.query(
      `UPDATE installments
       SET gateway_checkout_token = $1, updated_at = NOW()
       WHERE id = $2`,
      [token, installmentId]
    );

    return res.status(200).json({
      message: "Checkout session created successfully",
      data: {
        sessionId: token,
        sessionUrl: checkoutUrl,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error creating checkout session:", error?.message || error);
    return res.status(500).json({ message: "Failed to create checkout session" });
  }
}

// Reads the signed redirect params from wherever Safepay puts them (POST form
// body or GET query) so verify.signature (which inspects request.body) works
// either way.
function signatureShim(req) {
  const body =
    req.body && (req.body.tracker || req.body.sig) ? req.body : req.query || {};
  return { body };
}

/**
 * GET|POST /api/payments/safepay/return  (no auth — trust = Safepay signature)
 * Safepay redirects the browser here after a completed payment. We verify the
 * signature, record the payment by token, then redirect the browser to the SPA.
 */
export async function handleSafepayReturn(req, res) {
  const failRedirect = (caseId) =>
    res.redirect(
      302,
      `${frontendBaseUrl()}/client-payments${caseId ? `/${caseId}` : ""}?payment=failed`
    );

  if (!safepay) return failRedirect();

  try {
    const shim = signatureShim(req);
    const tracker = shim.body.tracker;

    if (!tracker || !safepay.verify.signature(shim)) {
      console.error("Safepay return: missing/invalid signature");
      return failRedirect();
    }

    const result = await recordPaymentByToken({
      checkoutToken: tracker,
      gatewayReference: shim.body.reference || tracker,
    });

    if (!result) {
      // Signature was valid but we have no installment for this token.
      return res.redirect(302, `${frontendBaseUrl()}/client-payments?payment=success`);
    }

    return res.redirect(
      302,
      `${frontendBaseUrl()}/client-payments/${result.caseId}?payment=success`
    );
  } catch (error) {
    console.error("Safepay return error:", error?.message || error);
    return failRedirect();
  }
}

/**
 * GET|POST /api/payments/safepay/cancel  (no auth)
 * Safepay redirects here when the user abandons the payment. Nothing is
 * recorded; we just bounce the browser back to the SPA.
 */
export async function handleSafepayCancel(req, res) {
  const caseId = req.query.caseId || (req.body && req.body.caseId);
  return res.redirect(
    302,
    `${frontendBaseUrl()}/client-payments${caseId ? `/${caseId}` : ""}?payment=cancel`
  );
}

/**
 * POST /api/payments/webhook  (no auth — trust = Safepay webhook signature)
 * Safety net: records the payment even if the browser never completed the
 * redirect. Uses the normal parsed JSON body (the SDK re-serializes body.data
 * for its SHA-512 check), so this route does NOT need a raw body.
 */
export async function handleSafepayWebhook(req, res) {
  if (!safepay || !process.env.SAFEPAY_WEBHOOK_SECRET) {
    return res.status(503).json({ message: "Webhook is not configured" });
  }

  try {
    const valid = await safepay.verify.webhook(req);
    if (!valid) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    // The signed return path is the primary recorder; this is a backup. The
    // exact `data` shape should be confirmed against the sandbox — we read the
    // tracker defensively and rely on idempotency to stay safe.
    const data = req.body?.data || {};
    const tracker = data.tracker || data.token || data.invoice || null;

    if (tracker) {
      await recordPaymentByToken({
        checkoutToken: tracker,
        gatewayReference: data.reference || tracker,
      });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Safepay webhook error:", error?.message || error);
    return res.status(400).json({ message: "Webhook error" });
  }
}
