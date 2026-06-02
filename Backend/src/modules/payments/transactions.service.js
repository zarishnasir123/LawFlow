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
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
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
