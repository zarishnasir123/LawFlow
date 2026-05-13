// Reconciliation script for Google-authenticated users.
//
// Why this exists: Supabase Auth (auth.users) and the LawFlow Postgres
// users table live in two different databases. A SQL FK cascade cannot
// span them. The /api/auth/webhooks/supabase endpoint already handles
// real-time deletes from Supabase -> LawFlow IF a Supabase Database
// Webhook is configured to invoke it on auth.users DELETE.
//
// This script is the safety net: it does a full sweep, finds LawFlow
// users with auth_provider='google' whose matching Supabase auth.users
// record has been deleted (or never existed), and deletes them. All
// dependent rows (client_profiles, auth_sessions, auth_identities,
// email_verification_otps, password_reset_tokens, lawyer_profiles,
// lawyer_verification_documents) cascade via existing FKs.
//
// Usage:
//   cd Backend
//   node src/scripts/syncSupabaseUsers.js            # dry-run
//   node src/scripts/syncSupabaseUsers.js --apply    # actually delete
//
// Requirements: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.

import "dotenv/config";

import { pool } from "../config/db.js";
import { getSupabaseClient, getSupabaseStorageConfig } from "../config/supabase.js";

const APPLY = process.argv.includes("--apply");
const PAGE_SIZE = 1000;

function log(...args) {
  console.log("[syncSupabaseUsers]", ...args);
}

async function listAllSupabaseUserIds(supabase) {
  const ids = new Set();

  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE
    });

    if (error) {
      throw new Error(`Supabase listUsers failed: ${error.message}`);
    }

    const batch = data?.users ?? [];
    for (const u of batch) {
      ids.add(u.id);
    }

    if (batch.length < PAGE_SIZE) break;
    page += 1;
  }

  return ids;
}

async function listLawFlowGoogleUsers() {
  const { rows } = await pool.query(
    `SELECT
      u.id AS user_id,
      u.email,
      u.created_at,
      (
        SELECT provider_user_id
        FROM auth_identities ai
        WHERE ai.user_id = u.id AND ai.provider = 'google'
        LIMIT 1
      ) AS google_provider_user_id
    FROM users u
    WHERE u.auth_provider = 'google'
    ORDER BY u.created_at ASC`
  );

  return rows;
}

async function deleteLawFlowUser(userId) {
  const { rowCount } = await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  return rowCount;
}

async function main() {
  const config = getSupabaseStorageConfig();
  if (config.mode !== "supabase") {
    console.error(
      `Supabase is not configured (missing: ${config.issues.join(", ")}). ` +
      `Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.`
    );
    process.exitCode = 1;
    return;
  }

  const supabase = getSupabaseClient();
  log("Listing Supabase auth.users…");
  const supabaseIds = await listAllSupabaseUserIds(supabase);
  log(`Found ${supabaseIds.size} active Supabase users.`);

  log("Listing LawFlow Google users…");
  const lawflowUsers = await listLawFlowGoogleUsers();
  log(`Found ${lawflowUsers.length} LawFlow users with auth_provider='google'.`);

  // Match strictly by the Supabase provider_user_id stored in auth_identities.
  // Per AGENTS.md we never fall back to email for OAuth identity — Supabase
  // can recycle an email across distinct auth.users rows, which would
  // silently hide real orphans here.
  const orphans = lawflowUsers.filter(
    (u) => !u.google_provider_user_id || !supabaseIds.has(u.google_provider_user_id)
  );

  if (orphans.length === 0) {
    log("No orphans found — LawFlow and Supabase are in sync.");
    return;
  }

  log(`Found ${orphans.length} orphan(s):`);
  for (const o of orphans) {
    log(`  - ${o.email} (LawFlow id=${o.user_id}, created=${o.created_at})`);
  }

  if (!APPLY) {
    log("\nDRY RUN — re-run with --apply to actually delete.");
    return;
  }

  log("\nDeleting orphans…");
  let deleted = 0;
  for (const o of orphans) {
    const count = await deleteLawFlowUser(o.user_id);
    if (count > 0) {
      log(`  deleted: ${o.email}`);
      deleted += 1;
    }
  }
  log(`Done. Deleted ${deleted} orphan(s). FK cascades handled dependent rows.`);
}

main()
  .catch((err) => {
    console.error("[syncSupabaseUsers] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    pool.end().catch(() => {});
  });
