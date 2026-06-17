import { pool } from "../../config/db.js";

function mapTransaction(row) {
  return {
    id: row.id,
    installmentId: row.installment_id,
    agreementId: row.agreement_id,
    caseId: row.case_id,
    clientUserId: row.client_user_id,
    lawyerUserId: row.lawyer_user_id,
    amount: parseFloat(row.amount),
    currency: row.currency,
    status: row.status,
    gateway: row.gateway,
    gatewayCheckoutToken: row.gateway_checkout_token,
    gatewayReference: row.gateway_reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    caseTitle: row.case_title,
    clientName: row.client_name,
    lawyerName: row.lawyer_name,
    installmentNumber: row.installment_number,
  };
}

function mapReceipt(row) {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    receiptNumber: row.receipt_number,
    installmentId: row.installment_id,
    agreementId: row.agreement_id,
    caseId: row.case_id,
    clientUserId: row.client_user_id,
    lawyerUserId: row.lawyer_user_id,
    amount: parseFloat(row.amount),
    currency: row.currency,
    paymentStatus: row.payment_status,
    issuedAt: row.issued_at,
    createdAt: row.created_at,
    caseTitle: row.case_title,
    clientName: row.client_name,
    lawyerName: row.lawyer_name,
    installmentNumber: row.installment_number,
  };
}

export async function listTransactionsForUser({ userId, role, caseId }) {
  const params = [userId];
  let caseFilter = "";
  if (caseId) {
    params.push(caseId);
    caseFilter = ` AND pt.case_id = $${params.length}`;
  }

  const roleFilter =
    role === "client"
      ? "pt.client_user_id = $1"
      : role === "lawyer"
        ? "pt.lawyer_user_id = $1"
        : "1=0";

  const result = await pool.query(
    `SELECT
      pt.*,
      c.title AS case_title,
      CONCAT(cu.first_name, ' ', cu.last_name) AS client_name,
      CONCAT(lu.first_name, ' ', lu.last_name) AS lawyer_name,
      i.installment_number
    FROM payment_transactions pt
    INNER JOIN cases c ON c.id = pt.case_id
    INNER JOIN users cu ON cu.id = pt.client_user_id
    INNER JOIN users lu ON lu.id = pt.lawyer_user_id
    INNER JOIN installments i ON i.id = pt.installment_id
    WHERE ${roleFilter}${caseFilter}
    ORDER BY pt.created_at DESC`,
    params
  );

  return result.rows.map(mapTransaction);
}

export async function listReceiptsForUser({ userId, role, caseId }) {
  const params = [userId];
  let caseFilter = "";
  if (caseId) {
    params.push(caseId);
    caseFilter = ` AND pr.case_id = $${params.length}`;
  }

  const roleFilter =
    role === "client"
      ? "pr.client_user_id = $1"
      : role === "lawyer"
        ? "pr.lawyer_user_id = $1"
        : "1=0";

  const result = await pool.query(
    `SELECT
      pr.*,
      c.title AS case_title,
      CONCAT(cu.first_name, ' ', cu.last_name) AS client_name,
      CONCAT(lu.first_name, ' ', lu.last_name) AS lawyer_name,
      i.installment_number
    FROM payment_receipts pr
    INNER JOIN cases c ON c.id = pr.case_id
    INNER JOIN users cu ON cu.id = pr.client_user_id
    INNER JOIN users lu ON lu.id = pr.lawyer_user_id
    INNER JOIN installments i ON i.id = pr.installment_id
    WHERE ${roleFilter}${caseFilter}
    ORDER BY pr.issued_at DESC`,
    params
  );

  return result.rows.map(mapReceipt);
}

export async function getReceiptById(receiptId, userId, role) {
  const result = await pool.query(
    `SELECT
      pr.*,
      c.title AS case_title,
      CONCAT(cu.first_name, ' ', cu.last_name) AS client_name,
      CONCAT(lu.first_name, ' ', lu.last_name) AS lawyer_name,
      i.installment_number
    FROM payment_receipts pr
    INNER JOIN cases c ON c.id = pr.case_id
    INNER JOIN users cu ON cu.id = pr.client_user_id
    INNER JOIN users lu ON lu.id = pr.lawyer_user_id
    INNER JOIN installments i ON i.id = pr.installment_id
    WHERE pr.id = $1
      AND ($2::text = 'client' AND pr.client_user_id = $3
        OR $2::text = 'lawyer' AND pr.lawyer_user_id = $3)`,
    [receiptId, role, userId]
  );

  if (result.rows.length === 0) return null;
  return mapReceipt(result.rows[0]);
}

export async function generateReceiptNumber(client) {
  const db = client || pool;
  const result = await db.query(
    `SELECT COUNT(*)::int AS count FROM payment_receipts`
  );
  const seq = result.rows[0].count + 1;
  const year = new Date().getFullYear();
  return `LF-RCP-${year}-${String(seq).padStart(6, "0")}`;
}

// Lawyer "Payments Received" view: the money clients have actually paid this
// lawyer, built from successful transactions. This is how "the money goes to
// the lawyer" is represented in-system (real bank settlement is out of scope).
export async function listLawyerEarnings(lawyerUserId) {
  // Gross + the marketplace split. platform_fee_amount / lawyer_net_amount were
  // added in the commission work and snapshotted per transaction; rows recorded
  // before that have NULL, so COALESCE treats them as "no fee taken" (the whole
  // amount is the lawyer's net) — that keeps gross = fee + net for every row.
  const totals = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::float AS total_received,
            COALESCE(SUM(COALESCE(platform_fee_amount, 0)), 0)::float AS platform_fee,
            COALESCE(SUM(COALESCE(lawyer_net_amount, amount)), 0)::float AS net_earned,
            COUNT(*)::int AS payments_count
     FROM payment_transactions
     WHERE lawyer_user_id = $1 AND status = 'success'`,
    [lawyerUserId]
  );

  // What's already been paid out, and what's mid-flight. A payout that is
  // requested or processing still ties up the money (it can't be requested
  // twice), so it reduces the available balance the same as a paid one;
  // cancelled/failed payouts release the money back.
  const payouts = await pool.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::float AS paid_out,
       COALESCE(SUM(amount) FILTER (WHERE status IN ('requested', 'processing')), 0)::float
         AS pending_payouts
     FROM payouts
     WHERE lawyer_user_id = $1`,
    [lawyerUserId]
  );

  // Current platform commission rate, only for the "platform fee (X%)" label.
  // The fee AMOUNT shown is the real per-transaction snapshot sum, not derived
  // from this rate, so a later rate change never rewrites historical earnings.
  const settings = await pool.query(
    `SELECT commission_rate FROM platform_settings WHERE id = 1`
  );
  const commissionRate = settings.rows[0]
    ? Number(settings.rows[0].commission_rate)
    : 10;

  const byCase = await pool.query(
    `SELECT
       pt.case_id,
       c.title AS case_title,
       CONCAT(cu.first_name, ' ', cu.last_name) AS client_name,
       SUM(pt.amount)::float AS total_received,
       COUNT(*)::int AS payments_count,
       MAX(pt.created_at) AS last_payment_at
     FROM payment_transactions pt
     INNER JOIN cases c ON c.id = pt.case_id
     INNER JOIN users cu ON cu.id = pt.client_user_id
     WHERE pt.lawyer_user_id = $1 AND pt.status = 'success'
     GROUP BY pt.case_id, c.title, cu.first_name, cu.last_name
     ORDER BY last_payment_at DESC`,
    [lawyerUserId]
  );

  const recent = await pool.query(
    `SELECT
       pt.*,
       c.title AS case_title,
       CONCAT(cu.first_name, ' ', cu.last_name) AS client_name,
       CONCAT(lu.first_name, ' ', lu.last_name) AS lawyer_name,
       i.installment_number
     FROM payment_transactions pt
     INNER JOIN cases c ON c.id = pt.case_id
     INNER JOIN users cu ON cu.id = pt.client_user_id
     INNER JOIN users lu ON lu.id = pt.lawyer_user_id
     INNER JOIN installments i ON i.id = pt.installment_id
     WHERE pt.lawyer_user_id = $1 AND pt.status = 'success'
     ORDER BY pt.created_at DESC
     LIMIT 10`,
    [lawyerUserId]
  );

  const grossEarned = totals.rows[0].total_received;
  const platformFee = totals.rows[0].platform_fee;
  const netEarned = totals.rows[0].net_earned;
  const paidOut = payouts.rows[0].paid_out;
  const pendingPayouts = payouts.rows[0].pending_payouts;
  // Available = the lawyer's net minus everything already tied up in payouts.
  // Clamp at 0 so floating-point dust can never show a tiny negative balance.
  const available = Math.max(0, netEarned - paidOut - pendingPayouts);

  return {
    totalReceived: grossEarned,
    paymentsCount: totals.rows[0].payments_count,
    // Marketplace balance breakdown: gross → platform fee → net → paid out →
    // available to withdraw. Drives the lawyer Earnings page money panel.
    balance: {
      grossEarned,
      platformFee,
      netEarned,
      paidOut,
      pendingPayouts,
      available,
      commissionRate,
    },
    byCase: byCase.rows.map((r) => ({
      caseId: r.case_id,
      caseTitle: r.case_title,
      clientName: r.client_name,
      totalReceived: parseFloat(r.total_received),
      paymentsCount: r.payments_count,
      lastPaymentAt: r.last_payment_at,
    })),
    recent: recent.rows.map(mapTransaction),
  };
}
