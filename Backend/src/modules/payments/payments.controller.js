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

// Marketplace commission rate (percent) the platform keeps from each payment.
// Read from the singleton platform_settings row; defaults to 10% if unset.
async function getCommissionRate(dbClient) {
  const result = await dbClient.query(
    "SELECT commission_rate FROM platform_settings WHERE id = 1"
  );
  const rate = result.rows[0] ? Number(result.rows[0].commission_rate) : 10;
  // Guard the split math: a missing/garbage/out-of-range rate must never produce
  // a negative fee or a lawyer net above the full amount. Fall back to 10%.
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return 10;
  return rate;
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

// Safepay's REST base for THIS environment (used for the server-to-server order
// status lookup below). Mirrors the SDK's own environment → host mapping.
function safepayApiBase() {
  const env = (process.env.SAFEPAY_ENVIRONMENT || "sandbox").toLowerCase();
  if (env === "production") return "https://api.getsafepay.com";
  if (env === "development") return "https://dev.api.getsafepay.com";
  return "https://sandbox.api.getsafepay.com";
}

/**
 * Asks Safepay (server-to-server, authenticated with our merchant secret)
 * whether a checkout actually completed. This is the source of truth the client
 * cannot forge: GET /order/v1/:tracker returns the order with its `state` and,
 * once money is captured, a settlement `transaction`. Returns the order object
 * (or null on any error / unknown tracker).
 */
async function fetchSafepayOrder(tracker) {
  if (!tracker || !process.env.SAFEPAY_SECRET_KEY) return null;
  try {
    const res = await fetch(`${safepayApiBase()}/order/v1/${tracker}`, {
      headers: { "X-SFPY-MERCHANT-SECRET": process.env.SAFEPAY_SECRET_KEY },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch (error) {
    console.error("Safepay order lookup failed:", error?.message || error);
    return null;
  }
}

// An order counts as successfully paid once the tracker has ended AND Safepay
// recorded a settlement transaction against it.
function isOrderPaid(order) {
  return Boolean(order && order.state === "TRACKER_ENDED" && order.transaction);
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
export async function recordPaymentByToken({ checkoutToken, gatewayReference }) {
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

    // Re-check for an existing transaction now that we hold the installment row
    // lock. A concurrent caller (the SPA retry loop, React's dev double-mount,
    // or the webhook firing alongside the redirect-confirm) can slip a row in
    // between our first check above and acquiring this lock. Without this, the
    // second caller would blow up on the UNIQUE token constraint; with it, it
    // returns a harmless duplicate.
    const lockedDup = await dbClient.query(
      `SELECT id, case_id FROM payment_transactions WHERE gateway_checkout_token = $1`,
      [checkoutToken]
    );
    if (lockedDup.rows.length > 0) {
      await dbClient.query("COMMIT");
      return {
        duplicate: true,
        transactionId: lockedDup.rows[0].id,
        caseId: lockedDup.rows[0].case_id,
      };
    }

    const row = installmentResult.rows[0];
    const amount = roundMoney(row.amount);

    // Split the payment into the platform's commission and the lawyer's net
    // share, snapshotting the rate so this row stays accurate if the platform
    // changes the rate later.
    const commissionRate = await getCommissionRate(dbClient);
    const platformFee = roundMoney((amount * commissionRate) / 100);
    const lawyerNet = roundMoney(amount - platformFee);

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
        gateway_reference,
        commission_rate,
        platform_fee_amount,
        lawyer_net_amount
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'PKR', 'success', 'safepay', $7, $8, $9, $10, $11)
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
        commissionRate,
        platformFee,
        lawyerNet,
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
    // Belt-and-suspenders: if a concurrent insert still won the race and tripped
    // the UNIQUE token constraint (23505), the payment IS recorded by the other
    // caller — return it as a duplicate instead of surfacing a 500.
    if (error?.code === "23505") {
      const existing = await pool.query(
        `SELECT id, case_id FROM payment_transactions WHERE gateway_checkout_token = $1`,
        [checkoutToken]
      );
      if (existing.rows.length > 0) {
        return {
          duplicate: true,
          transactionId: existing.rows[0].id,
          caseId: existing.rows[0].case_id,
        };
      }
    }
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

    // Safepay takes the amount in the MAJOR unit (rupees), not paisa. Verified
    // against the sandbox: sending amount*100 made Safepay charge 100x (a
    // Rs 1,111.11 installment showed as Rs 111,111). So send the rupee amount.
    const { token } = await safepay.payments.create({
      amount: parsedAmount,
      currency,
    });

    // Redirect the browser straight back to the SPA (not the ngrok backend URL,
    // whose free-tier interstitial breaks the return). Safepay appends the
    // signed tracker + sig to this URL; the SPA reads them and calls
    // POST /payments/confirm, which verifies the signature and records the
    // payment. Webhooks stay on as a best-effort backup.
    const appBase = frontendBaseUrl();
    const checkoutUrl = safepay.checkout.create({
      token,
      orderId: installmentId,
      redirectUrl: `${appBase}/client-payments/${installment.case_id}`,
      cancelUrl: `${appBase}/client-payments/${installment.case_id}?payment=cancel`,
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
 * POST /api/payments/confirm  (no auth — trust = our server-to-server Safepay check)
 * Called by the SPA right after Safepay redirects the browser back to the app.
 * Safepay's hosted checkout appends only `order_id` (our installment id) to the
 * return URL — no signed tracker — so we look up the tracker we stored for that
 * installment and ask Safepay directly whether it was actually paid. The client
 * cannot forge this: the verdict comes from Safepay, authenticated with our
 * merchant secret. This is the PRIMARY recorder and avoids the ngrok
 * interstitial that blocks a browser return to the backend. Idempotent via the
 * UNIQUE gateway token.
 *
 * Accepts `{ orderId }` (the installment id from the return URL). Still accepts
 * a raw `{ tracker }` for backwards compatibility.
 */
export async function confirmPayment(req, res) {
  if (!safepay) {
    return res.status(503).json({ message: "Payment service is not configured" });
  }

  const orderId = req.body?.orderId || req.body?.installmentId || null;
  let tracker = req.body?.tracker || null;

  if (!tracker && orderId) {
    if (!isValidUuid(orderId)) {
      return res.status(400).json({ message: "Invalid order id" });
    }
    const lookup = await pool.query(
      `SELECT gateway_checkout_token FROM installments WHERE id = $1`,
      [orderId]
    );
    tracker = lookup.rows[0]?.gateway_checkout_token || null;
  }

  if (!tracker) {
    return res.status(400).json({ message: "No payment found to confirm" });
  }

  // Source of truth: ask Safepay whether this checkout actually completed.
  const order = await fetchSafepayOrder(tracker);
  if (!isOrderPaid(order)) {
    // Not paid yet (or still settling). Tell the SPA to keep waiting; nothing
    // is recorded so a genuine payment can still be confirmed on a retry.
    return res.status(202).json({ recorded: false, pending: true, caseId: null });
  }

  const result = await recordPaymentByToken({
    checkoutToken: tracker,
    gatewayReference:
      req.body?.reference ||
      order.transaction?.reference ||
      order.transaction?.token ||
      tracker,
  });

  // This endpoint is intentionally public (the browser may return from Safepay
  // with an expired access token). It's safe because the verdict comes from
  // Safepay's order status, fetched with our merchant secret — a caller cannot
  // forge a payment or mark an unpaid installment as paid, and the recorded
  // transaction is built entirely from our own DB (correct client/lawyer/case).
  // We do NOT echo the caseId back, so an unauthenticated caller learns nothing
  // about an installment beyond whether their own confirm succeeded.
  return res.status(200).json({
    recorded: Boolean(result),
    duplicate: Boolean(result?.duplicate),
  });
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
  // The SPA confirm path (POST /payments/confirm) is the primary recorder. This
  // webhook is a best-effort backup: only the SDK-verifiable `{ data: ... }`
  // payload shape can be checked, and we ALWAYS acknowledge with 200 so Safepay
  // doesn't retry forever on payload shapes we can't verify.
  try {
    const data = req.body?.data;
    if (
      data &&
      safepay &&
      process.env.SAFEPAY_WEBHOOK_SECRET &&
      safepay.verify.webhook(req)
    ) {
      const tracker = data.tracker || data.token || data.invoice || null;
      if (tracker) {
        await recordPaymentByToken({
          checkoutToken: tracker,
          gatewayReference: data.reference || tracker,
        });
      }
    }
  } catch (error) {
    console.error("Safepay webhook (ignored):", error?.message || error);
  }

  return res.status(200).json({ received: true });
}
