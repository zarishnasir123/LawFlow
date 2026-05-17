// Local-dev helper: ensure the seed admin user exists.
//
// Use when:
//  - The seeded admin was deleted manually
//  - Approving/rejecting lawyers fails with FK violation on
//    lawyer_profiles.verified_by → users(id)
//
// Idempotent: skips insert if an admin with this email already exists.
//
// Run with:
//   node Backend/src/scripts/seedAdmin.js

import "dotenv/config";
import bcrypt from "bcryptjs";

import { pool } from "../config/db.js";

const ADMIN_EMAIL = "LfAdmin@gmail.com";
const ADMIN_PASSWORD = "Admin@123";
const ADMIN_FIRST_NAME = "LawFlow";
const ADMIN_LAST_NAME = "Admin";
const ADMIN_PHONE = "+920000000000";
const ADMIN_CNIC = "34104-0000000-1";

async function main() {
  const client = await pool.connect();

  try {
    const existing = await client.query(
      `SELECT u.id, u.email, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.email = $1`,
      [ADMIN_EMAIL]
    );

    if (existing.rowCount > 0) {
      const row = existing.rows[0];
      console.log(
        `Admin user already present: ${row.email} (role=${row.role}, id=${row.id}). No changes.`
      );
      return;
    }

    const adminRoleResult = await client.query(
      `SELECT id FROM roles WHERE name = 'admin'`
    );
    if (adminRoleResult.rowCount === 0) {
      throw new Error(
        "roles table has no 'admin' row. Re-run schema.sql to recreate reference data."
      );
    }
    const adminRoleId = adminRoleResult.rows[0].id;

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const inserted = await client.query(
      `INSERT INTO users (
         role_id, first_name, last_name, email, phone, cnic,
         password_hash, auth_provider, email_verified, account_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'local', true, 'active')
       RETURNING id, email`,
      [
        adminRoleId,
        ADMIN_FIRST_NAME,
        ADMIN_LAST_NAME,
        ADMIN_EMAIL,
        ADMIN_PHONE,
        ADMIN_CNIC,
        passwordHash,
      ]
    );

    console.log(
      `Seeded admin user: ${inserted.rows[0].email} (id=${inserted.rows[0].id}).`
    );
    console.log(`Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("seedAdmin failed:", err.message);
  process.exit(1);
});
