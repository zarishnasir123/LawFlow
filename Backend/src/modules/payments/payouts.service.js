import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";

// Where LawFlow settles a lawyer's collected installment payments. The platform
// collects via its own Safepay account and pays each lawyer his share to this
// account. These fields live on lawyer_profiles and are only ever returned to
// the lawyer himself — never on the public directory.
function mapPayout(row) {
  if (!row) return null;
  return {
    accountTitle: row.payout_account_title,
    accountNumber: row.payout_account_number,
    bankName: row.payout_bank_name,
  };
}

export async function getLawyerPayoutAccount(lawyerUserId) {
  const result = await pool.query(
    `SELECT payout_account_title, payout_account_number, payout_bank_name
     FROM lawyer_profiles
     WHERE user_id = $1`,
    [lawyerUserId]
  );
  return mapPayout(result.rows[0]);
}

export async function upsertLawyerPayoutAccount(
  lawyerUserId,
  { accountTitle, accountNumber, bankName }
) {
  const clean = (value, max) => {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed === "" ? null : trimmed.slice(0, max);
  };

  const result = await pool.query(
    `UPDATE lawyer_profiles
     SET payout_account_title = $2,
         payout_account_number = $3,
         payout_bank_name = $4,
         updated_at = NOW()
     WHERE user_id = $1
     RETURNING payout_account_title, payout_account_number, payout_bank_name`,
    [
      lawyerUserId,
      clean(accountTitle, 150),
      clean(accountNumber, 50),
      clean(bankName, 150),
    ]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "Lawyer profile not found");
  }

  return mapPayout(result.rows[0]);
}

// =====================================================================
// Payout records — the platform settling a lawyer's net earnings to their
// bank account. A payout's lifecycle: requested → (processing) → paid, or
// failed / cancelled (which release the money back to the available balance).
// =====================================================================

const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Every status a payout row can hold (matches the schema CHECK).
export const PAYOUT_STATUSES = [
  "requested",
  "processing",
  "paid",
  "failed",
  "cancelled",
];

// Which status changes the admin is allowed to make from a given status. A
// requested/processing payout still ties up money; paid/failed/cancelled are
// terminal. paid & failed are the two outcomes that "process" the request.
const ALLOWED_TRANSITIONS = {
  requested: ["processing", "paid", "failed", "cancelled"],
  processing: ["paid", "failed"],
};

// One payout record mapped to the camelCase JSON shape the UIs consume. Bank
// details are the snapshot stored on the payout row (taken at request time),
// not the lawyer's current profile — so history stays accurate after an edit.
function mapPayoutRow(row) {
  return {
    id: row.id,
    amount: row.amount != null ? parseFloat(row.amount) : 0,
    currency: row.currency,
    status: row.status,
    accountTitle: row.payout_account_title,
    accountNumber: row.payout_account_number,
    bankName: row.payout_bank_name,
    reference: row.reference,
    note: row.note,
    requestedAt: row.requested_at,
    processedAt: row.processed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// A lawyer's withdrawable balance, computed inside a caller-supplied client so
// requestPayout can read it under the same lock it writes with. Available =
// net earned (gross minus the platform fee, snapshotted per transaction) minus
// every payout that still ties money up (requested + processing + paid).
async function computeAvailableBalance(client, lawyerUserId) {
  const net = await client.query(
    `SELECT COALESCE(SUM(COALESCE(lawyer_net_amount, amount)), 0)::float AS net
     FROM payment_transactions
     WHERE lawyer_user_id = $1 AND status = 'success'`,
    [lawyerUserId]
  );
  const tied = await client.query(
    `SELECT COALESCE(SUM(amount), 0)::float AS tied
     FROM payouts
     WHERE lawyer_user_id = $1
       AND status IN ('requested', 'processing', 'paid')`,
    [lawyerUserId]
  );
  return Math.max(0, round2(net.rows[0].net - tied.rows[0].tied));
}

// Lawyer asks to withdraw their full available balance. Runs in a transaction
// behind a per-lawyer advisory lock so two rapid clicks can't both pass the
// balance check and create two requests for the same money.
export async function requestPayout(lawyerUserId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      lawyerUserId,
    ]);

    const acctResult = await client.query(
      `SELECT payout_account_title, payout_account_number, payout_bank_name
       FROM lawyer_profiles WHERE user_id = $1`,
      [lawyerUserId]
    );
    const acct = acctResult.rows[0];
    if (!acct || !acct.payout_account_number || !acct.payout_account_title) {
      throw new ApiError(
        400,
        "Add your payout bank account before requesting a payout."
      );
    }

    // One open request at a time keeps the ledger easy to reason about and
    // prevents accidental double requests.
    const openResult = await client.query(
      `SELECT id FROM payouts
       WHERE lawyer_user_id = $1 AND status IN ('requested', 'processing')
       LIMIT 1`,
      [lawyerUserId]
    );
    if (openResult.rows.length > 0) {
      throw new ApiError(409, "You already have a payout request in progress.");
    }

    const available = await computeAvailableBalance(client, lawyerUserId);
    if (available <= 0) {
      throw new ApiError(
        400,
        "You don't have any balance available to withdraw yet."
      );
    }

    const insertResult = await client.query(
      `INSERT INTO payouts (
         lawyer_user_id, amount, status,
         payout_account_title, payout_account_number, payout_bank_name
       )
       VALUES ($1, $2, 'requested', $3, $4, $5)
       RETURNING *`,
      [
        lawyerUserId,
        available,
        acct.payout_account_title,
        acct.payout_account_number,
        acct.payout_bank_name,
      ]
    );

    await client.query("COMMIT");
    return mapPayoutRow(insertResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// The lawyer's own payout history, newest first.
export async function listLawyerPayouts(lawyerUserId) {
  const result = await pool.query(
    `SELECT * FROM payouts WHERE lawyer_user_id = $1 ORDER BY created_at DESC`,
    [lawyerUserId]
  );
  return result.rows.map(mapPayoutRow);
}

// Admin payout queue: every payout (optionally filtered by status) with the
// lawyer's name/email and who processed it. Open requests float to the top.
export async function listPayoutsForAdmin({ status } = {}) {
  const params = [];
  let where = "";
  if (status) {
    params.push(status);
    where = `WHERE p.status = $${params.length}`;
  }
  const result = await pool.query(
    `SELECT
       p.*,
       CONCAT(lu.first_name, ' ', lu.last_name) AS lawyer_name,
       lu.email AS lawyer_email,
       CONCAT(au.first_name, ' ', au.last_name) AS processed_by_name
     FROM payouts p
     INNER JOIN users lu ON lu.id = p.lawyer_user_id
     LEFT JOIN users au ON au.id = p.processed_by_admin_id
     ${where}
     ORDER BY
       CASE p.status
         WHEN 'requested' THEN 0
         WHEN 'processing' THEN 1
         ELSE 2
       END,
       p.created_at DESC`,
    params
  );
  return result.rows.map((row) => ({
    ...mapPayoutRow(row),
    lawyerUserId: row.lawyer_user_id,
    lawyerName: row.lawyer_name,
    lawyerEmail: row.lawyer_email,
    processedByName: row.processed_by_name,
  }));
}

// Admin moves a payout along its lifecycle. Validates the transition, requires
// a bank reference when marking paid, and stamps who/when on paid|failed.
// Returns the updated payout plus lawyerUserId so the caller can notify them.
export async function transitionPayout({
  payoutId,
  adminUserId,
  status,
  reference,
  note,
}) {
  if (!PAYOUT_STATUSES.includes(status)) {
    throw new ApiError(400, "Invalid payout status.");
  }
  if (status === "paid" && !String(reference || "").trim()) {
    throw new ApiError(
      400,
      "A bank reference is required when marking a payout paid."
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT * FROM payouts WHERE id = $1 FOR UPDATE`,
      [payoutId]
    );
    if (current.rows.length === 0) {
      throw new ApiError(404, "Payout not found.");
    }

    const payout = current.rows[0];
    const allowed = ALLOWED_TRANSITIONS[payout.status] || [];
    if (!allowed.includes(status)) {
      throw new ApiError(
        409,
        `Cannot change a ${payout.status} payout to ${status}.`
      );
    }

    // paid & failed are the moments money actually moved (or didn't), so they
    // record who did it and when. processing is just a staging flag.
    const setsProcessed = status === "paid" || status === "failed";
    const updated = await client.query(
      `UPDATE payouts
       SET status = $2,
           reference = COALESCE($3, reference),
           note = COALESCE($4, note),
           processed_by_admin_id =
             CASE WHEN $5 THEN $6 ELSE processed_by_admin_id END,
           processed_at = CASE WHEN $5 THEN NOW() ELSE processed_at END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        payoutId,
        status,
        reference ? String(reference).trim().slice(0, 255) : null,
        note ? String(note).trim().slice(0, 2000) : null,
        setsProcessed,
        adminUserId,
      ]
    );

    await client.query("COMMIT");
    const row = updated.rows[0];
    return { ...mapPayoutRow(row), lawyerUserId: row.lawyer_user_id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
