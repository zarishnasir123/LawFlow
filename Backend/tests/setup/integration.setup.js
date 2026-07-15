// Runs in every INTEGRATION test worker BEFORE the test file's imports, which
// is what makes it safe to `import app from "../../src/app.js"` in tests:
// src/app.js never loads dotenv and config/db.js reads DATABASE_URL at first
// import, so remapping the env here guarantees the pool is built against the
// throwaway test database.

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { runTestDatabaseGuard } from "./guard.js";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../.env.test") });
dotenv.config({ path: path.resolve(here, "../../.env.test.local"), override: true });

const { url: testDatabaseUrl } = runTestDatabaseGuard();
process.env.DATABASE_URL = testDatabaseUrl;

// Hard-blank real external services so a forgotten mock can never reach them.
// Email falls back to console mode; Supabase storage returns null (503 paths).
for (const key of [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "EMAIL_HOST",
  "EMAIL_USER",
  "EMAIL_PASS",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
]) {
  delete process.env[key];
}

// Fake Safepay keys so payments.controller.js loads in "configured" mode with
// the SDK mocked. Suites that test the unconfigured 503 path delete these
// three keys in their own file before importing the app.
process.env.SAFEPAY_API_KEY ||= "sec_test_fake_key";
process.env.SAFEPAY_SECRET_KEY ||= "test_fake_secret";
process.env.SAFEPAY_WEBHOOK_SECRET ||= "test_fake_webhook_secret";
