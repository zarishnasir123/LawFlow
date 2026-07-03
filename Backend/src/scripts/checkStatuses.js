import "dotenv/config";
import { pool } from "../config/db.js";

const { rows } = await pool.query(
  `SELECT u.account_status, lp.verification_status, u.email
   FROM lawyer_profiles lp
   JOIN users u ON u.id = lp.user_id
   LIMIT 10`
);
console.table(rows);
await pool.end();
