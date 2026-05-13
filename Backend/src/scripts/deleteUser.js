// Safely delete a LawFlow user by email, cascading into Supabase
// auth.users for Google-authenticated accounts.
//
// Use this instead of raw "DELETE FROM users WHERE email = ..." so that
// Google users do not leave an orphan row in Supabase auth.users (which
// would otherwise let them log back in and recreate a fresh LawFlow row).
//
// Local users (auth_provider='local') skip the Supabase call automatically.
//
// Usage:
//   cd Backend
//   node src/scripts/deleteUser.js <email>                 # delete
//   node src/scripts/deleteUser.js <email> --dry-run       # preview only
//
// Requirements: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.

import "dotenv/config";

import { pool } from "../config/db.js";
import { getSupabaseClient, getSupabaseStorageConfig } from "../config/supabase.js";

const DRY_RUN = process.argv.includes("--dry-run");
const email = process.argv.find((a, i) => i >= 2 && !a.startsWith("--"));

function log(...args) {
  console.log("[deleteUser]", ...args);
}

async function main() {
  if (!email) {
    console.error("Usage: node src/scripts/deleteUser.js <email> [--dry-run]");
    process.exitCode = 1;
    return;
  }

  const { rows } = await pool.query(
    `SELECT
      u.id,
      u.email,
      u.auth_provider,
      (
        SELECT provider_user_id
        FROM auth_identities ai
        WHERE ai.user_id = u.id AND ai.provider = 'google'
        LIMIT 1
      ) AS google_provider_user_id
    FROM users u
    WHERE u.email = $1
    LIMIT 1`,
    [email.toLowerCase().trim()]
  );

  if (rows.length === 0) {
    log(`No user found with email '${email}'. Nothing to do.`);
    return;
  }

  const user = rows[0];
  log(`Found user id=${user.id} provider=${user.auth_provider}`);

  if (DRY_RUN) {
    log("DRY RUN — no changes made.");
    if (user.auth_provider === "google") {
      log(`Would call supabase.auth.admin.deleteUser('${user.google_provider_user_id ?? "<unknown>"}')`);
    }
    log(`Would DELETE FROM users WHERE id = '${user.id}' (FK cascades clean up profiles, sessions, OTPs, etc.)`);
    return;
  }

  if (user.auth_provider === "google") {
    if (!user.google_provider_user_id) {
      log("WARN: Google user has no auth_identities row — cannot identify Supabase auth.users record. Skipping Supabase delete.");
    } else {
      const config = getSupabaseStorageConfig();
      if (config.mode !== "supabase") {
        log(`WARN: Supabase not configured (missing: ${config.issues.join(", ")}). Skipping Supabase delete.`);
      } else {
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.admin.deleteUser(user.google_provider_user_id);
        if (error) {
          if (/not_found|user not found/i.test(error.message || "")) {
            log(`Supabase auth.users row already gone — continuing.`);
          } else {
            throw new Error(`Supabase deleteUser failed: ${error.message}`);
          }
        } else {
          log(`Deleted Supabase auth.users row ${user.google_provider_user_id}.`);
        }
      }
    }
  }

  const { rowCount } = await pool.query(`DELETE FROM users WHERE id = $1`, [user.id]);
  log(`Deleted ${rowCount} LawFlow user row. FK cascades handled dependents.`);
}

main()
  .catch((err) => {
    console.error("[deleteUser] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    pool.end().catch(() => {});
  });
