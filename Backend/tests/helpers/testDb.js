import { pool } from "../../src/config/db.js";

// Reference data provisioned by schema.sql that suites rely on. Everything
// else is wiped between tests so no test depends on another's leftovers.
const KEEP_TABLES = new Set([
  "roles",
  "case_types",
  "courtrooms",
  "platform_settings",
]);

export async function resetDb() {
  const { rows } = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
  );
  const targets = rows
    .map((r) => r.tablename)
    .filter((name) => !KEEP_TABLES.has(name));
  if (targets.length > 0) {
    await pool.query(
      `TRUNCATE TABLE ${targets.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`
    );
  }
  // The commission rate is reference data too, but tests may change it —
  // restore the schema default so payment suites always start from 10%.
  await pool.query(
    `INSERT INTO platform_settings (id, commission_rate) VALUES (1, 10.00)
     ON CONFLICT (id) DO UPDATE SET commission_rate = 10.00`
  );
}

export async function closePool() {
  await pool.end();
}
