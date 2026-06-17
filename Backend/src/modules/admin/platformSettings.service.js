import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";

// =====================================================================
// Platform settings — admin read/update of the marketplace commission rate
// (the singleton platform_settings row, id = 1).
//
// IMPORTANT: the rate is SNAPSHOTTED onto every payment at record time
// (payment_transactions.commission_rate), so changing it here only affects
// FUTURE payments — historical earnings/splits never change. The payment hot
// path reads the rate via getCommissionRate() in payments.controller.js; this
// module is the admin-facing read/update.
// =====================================================================

const DEFAULT_RATE = 10;

export async function getCommissionRateSetting() {
  const result = await pool.query(
    `SELECT commission_rate, updated_at FROM platform_settings WHERE id = 1`
  );
  if (result.rows.length === 0) {
    return { commissionRate: DEFAULT_RATE, updatedAt: null };
  }
  return {
    commissionRate: Number(result.rows[0].commission_rate),
    updatedAt: result.rows[0].updated_at,
  };
}

export async function updateCommissionRate(rate) {
  const value = Number(rate);
  // Guard the split math: a rate outside 0–100 would corrupt every future
  // payment's fee/net. The DB has a CHECK too, but reject early with a clean
  // message rather than surfacing a raw constraint error.
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new ApiError(400, "Commission rate must be a number between 0 and 100.");
  }
  const rounded = Math.round(value * 100) / 100;

  // Upsert the singleton (it's seeded in schema.sql, but ON CONFLICT keeps this
  // safe on a DB where the row is somehow missing).
  const result = await pool.query(
    `INSERT INTO platform_settings (id, commission_rate, updated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE
       SET commission_rate = EXCLUDED.commission_rate, updated_at = NOW()
     RETURNING commission_rate, updated_at`,
    [rounded]
  );

  return {
    commissionRate: Number(result.rows[0].commission_rate),
    updatedAt: result.rows[0].updated_at,
  };
}
