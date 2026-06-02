import Stripe from "stripe";
import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import { isValidUuid } from "../../utils/uuid.js";
import { getInstallmentForCheckout } from "./agreements.service.js";
import { generateReceiptNumber } from "./transactions.service.js";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function frontendBaseUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
}

async function processCompletedCheckout(session) {
  const { installmentId, caseId, clientId, agreementId } = session.metadata || {};

  if (!installmentId || !caseId || !clientId) {
    throw new ApiError(400, "Missing checkout metadata");
  }

  const dbClient = await pool.connect();
  try {
    await dbClient.query("BEGIN");

    const existingTxn = await dbClient.query(
      `SELECT id FROM payment_transactions
       WHERE stripe_checkout_session_id = $1`,
      [session.id]
    );

    if (existingTxn.rows.length > 0) {
      await dbClient.query("COMMIT");
      return { duplicate: true, transactionId: existingTxn.rows[0].id };
    }

    const installmentResult = await dbClient.query(
      `SELECT i.*, a.lawyer_user_id
       FROM installments i
       INNER JOIN agreements a ON a.id = i.agreement_id
       WHERE i.id = $1
       FOR UPDATE`,
      [installmentId]
    );

    if (installmentResult.rows.length === 0) {
      throw new ApiError(404, "Installment not found");
    }

    const installment = installmentResult.rows[0];
    const amount = roundMoney((session.amount_total || 0) / 100);
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null;

    if (installment.status !== "paid") {
      await dbClient.query(
        `UPDATE installments
         SET status = 'paid', paid_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [installmentId]
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
        stripe_checkout_session_id,
        stripe_payment_intent_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'PKR', 'success', $7, $8)
      RETURNING *`,
      [
        installmentId,
        agreementId || installment.agreement_id,
        caseId,
        clientId,
        installment.lawyer_user_id,
        amount || installment.amount,
        session.id,
        paymentIntentId,
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
        installmentId,
        agreementId || installment.agreement_id,
        caseId,
        clientId,
        installment.lawyer_user_id,
        amount || installment.amount,
      ]
    );

    const agreementKey = agreementId || installment.agreement_id;
    const paidCount = await dbClient.query(
      `SELECT COUNT(*)::int AS count
       FROM installments
       WHERE agreement_id = $1 AND status = 'paid'`,
      [agreementKey]
    );
    const totalCount = await dbClient.query(
      `SELECT COUNT(*)::int AS count FROM installments WHERE agreement_id = $1`,
      [agreementKey]
    );

    if (
      totalCount.rows[0].count > 0 &&
      paidCount.rows[0].count === totalCount.rows[0].count
    ) {
      await dbClient.query(
        `UPDATE agreements SET status = 'completed', updated_at = NOW() WHERE id = $1`,
        [agreementKey]
      );
    }

    await dbClient.query("COMMIT");
    return {
      duplicate: false,
      transactionId: transaction.id,
      receiptNumber,
      caseId,
    };
  } catch (error) {
    await dbClient.query("ROLLBACK");
    throw error;
  } finally {
    dbClient.release();
  }
}

export async function createCheckoutSession(req, res) {
  const { installmentId, amount, caseName } = req.body;
  const currency = (process.env.STRIPE_CURRENCY || req.body.currency || "pkr")
    .toLowerCase()
    .trim();
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

  if (!stripe) {
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Installment Payment - ${caseName}`,
              description: `Case: ${caseName}`,
            },
            unit_amount: Math.round(parsedAmount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${frontendBaseUrl()}/client-payments/${installment.case_id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBaseUrl()}/client-payments/${installment.case_id}?payment=cancel`,
      metadata: {
        installmentId,
        caseId: installment.case_id,
        clientId: installment.client_user_id,
        agreementId: installment.agreement_id,
      },
    });

    await pool.query(
      `UPDATE installments
       SET stripe_checkout_session_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [session.id, installmentId]
    );

    return res.status(200).json({
      message: "Checkout session created successfully",
      data: {
        sessionId: session.id,
        sessionUrl: session.url,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error creating checkout session:", error);
    return res.status(500).json({ message: "Failed to create checkout session" });
  }
}

/** Records payment when client returns from Stripe (webhook may not reach localhost). */
export async function confirmCheckoutSession(req, res) {
  const { sessionId } = req.body;
  const userId = req.user.sub;

  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ message: "sessionId is required" });
  }

  if (!stripe) {
    return res.status(503).json({ message: "Payment service is not configured" });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment is not completed yet" });
    }

    const metaClientId = session.metadata?.clientId;
    if (metaClientId && metaClientId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const installmentId = session.metadata?.installmentId;
    if (!installmentId || !isValidUuid(installmentId)) {
      return res.status(400).json({ message: "Invalid payment session" });
    }

    await getInstallmentForCheckout(installmentId, userId, "client");

    const result = await processCompletedCheckout(session);

    return res.status(200).json({
      message: result.duplicate
        ? "Payment was already recorded"
        : "Payment recorded successfully",
      data: result,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error confirming checkout session:", error);
    const pgMissing =
      error?.code === "42P01" &&
      /payment_transactions|payment_receipts/i.test(error?.message || "");
    if (pgMissing) {
      return res.status(500).json({
        message:
          "Payment tables are missing. Run Backend/src/models/schema.sql on your database.",
      });
    }
    return res.status(500).json({ message: "Failed to confirm payment" });
  }
}

export async function handleStripeWebhook(req, res) {
  const signature = req.headers["stripe-signature"];
  const rawBody = req.body;

  if (!signature) {
    return res.status(400).json({ message: "Missing stripe-signature header" });
  }

  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ message: "Webhook is not configured" });
  }

  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === "checkout.session.completed") {
      await processCompletedCheckout(event.data.object);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(400).json({ message: "Webhook error" });
  }
}
