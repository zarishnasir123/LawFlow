import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function backfill() {
  console.log("Starting backfill for existing agreements missing service charge installments...");
  try {
    const result = await pool.query(`
      INSERT INTO installments (payment_plan_id, agreement_id, installment_number, amount, due_date, status)
      SELECT 
        pp.id AS payment_plan_id,
        a.id AS agreement_id,
        0 AS installment_number,
        a.lawyer_base_fee AS amount,
        a.created_at::date AS due_date,
        'pending' AS status
      FROM agreements a
      INNER JOIN payment_plans pp ON pp.agreement_id = a.id
      LEFT JOIN installments i ON i.agreement_id = a.id AND i.installment_number = 0
      WHERE i.id IS NULL AND a.lawyer_base_fee > 0
      RETURNING id, agreement_id, amount;
    `);
    console.log(`Successfully backfilled ${result.rowCount} agreements with service charge installments!`);
    if (result.rowCount > 0) {
      console.log("Backfilled rows:", result.rows);
    }
  } catch (error) {
    console.error("Backfill failed:", error);
  } finally {
    await pool.end();
  }
}

backfill();
