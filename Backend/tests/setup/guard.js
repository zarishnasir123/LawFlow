// Database safety guard for the test suite.
//
// Backend/src/models/schema.sql is a DROP-AND-RECREATE script: provisioning a
// test database from it erases every row. This guard makes it impossible for
// the test suite to run against anything except a local throwaway database.
// Never weaken or bypass these checks (see AGENTS.md > Testing Rules).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const FORBIDDEN_FRAGMENTS = ["supabase", "pooler", "amazonaws", "neon", "render"];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const ALLOWED_NAME_SUFFIXES = ["_test", "_e2e"];

const SETUP_HELP = [
  "TEST_DATABASE_URL is not set.",
  "",
  "Integration tests need a local THROWAWAY PostgreSQL database (it gets wiped",
  "and rebuilt from schema.sql on every run). Create Backend/.env.test.local",
  "(gitignored) containing:",
  "",
  "  TEST_DATABASE_URL=postgresql://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/lawflow_test",
  "",
  "The database itself is created automatically on first run.",
].join("\n");

/**
 * Validates that a candidate test-database URL is safe to wipe.
 * Pure function (no env access) so it can be unit tested directly.
 * Throws with a human-readable reason; returns { url, databaseName } on success.
 */
export function assertSafeTestDatabaseUrl(testUrl, realDatabaseUrl = null) {
  if (typeof testUrl !== "string" || testUrl.trim() === "") {
    throw new Error(SETUP_HELP);
  }

  const raw = testUrl.trim();
  const lowered = raw.toLowerCase();

  for (const fragment of FORBIDDEN_FRAGMENTS) {
    if (lowered.includes(fragment)) {
      throw new Error(
        `Refusing to run tests: TEST_DATABASE_URL contains "${fragment}", which looks like a ` +
          "hosted/real database. Tests DROP every table. Point TEST_DATABASE_URL at a local " +
          "throwaway database ending in _test."
      );
    }
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      "Refusing to run tests: TEST_DATABASE_URL is not a valid connection URL. Expected " +
        "postgresql://user:password@localhost:5432/lawflow_test (percent-encode special " +
        "characters in the password if needed)."
    );
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `Refusing to run tests: TEST_DATABASE_URL host "${parsed.hostname}" is not local. ` +
        "Only localhost / 127.0.0.1 / ::1 are allowed because the test suite wipes the database."
    );
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!ALLOWED_NAME_SUFFIXES.some((suffix) => databaseName.endsWith(suffix))) {
    throw new Error(
      `Refusing to run tests: database name "${databaseName}" must end in _test or _e2e ` +
        "so a real database can never be provisioned by mistake."
    );
  }

  if (
    typeof realDatabaseUrl === "string" &&
    realDatabaseUrl.trim() !== "" &&
    realDatabaseUrl.trim() === raw
  ) {
    throw new Error(
      "Refusing to run tests: TEST_DATABASE_URL is identical to the DATABASE_URL in " +
        "Backend/.env. Tests must use a separate throwaway database."
    );
  }

  return { url: raw, databaseName };
}

/** Reads DATABASE_URL from Backend/.env WITHOUT applying it to process.env. */
export function readRealDatabaseUrl() {
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env");
  if (!fs.existsSync(envPath)) return null;
  const parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));
  return parsed.DATABASE_URL ?? null;
}

/** Runs the full guard against process.env. Called by every integration setup path. */
export function runTestDatabaseGuard(env = process.env) {
  return assertSafeTestDatabaseUrl(env.TEST_DATABASE_URL, readRealDatabaseUrl());
}
