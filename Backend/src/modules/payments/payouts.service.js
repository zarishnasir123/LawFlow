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
