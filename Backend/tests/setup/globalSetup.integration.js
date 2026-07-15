// Global setup for the integration test project. Runs ONCE per `vitest run`,
// in its own process: validates the guard, creates the throwaway database if
// it does not exist yet, and rebuilds it from src/models/schema.sql.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { runTestDatabaseGuard } from "./guard.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup() {
  dotenv.config({ path: path.resolve(here, "../../.env.test") });
  dotenv.config({ path: path.resolve(here, "../../.env.test.local"), override: true });

  if (!process.env.TEST_DATABASE_URL) {
    // No test DB configured. Integration test files themselves will fail with
    // full setup instructions via integration.setup.js; skipping here keeps
    // plain `npm test` usable for developers who only run unit tests.
    console.warn(
      "[tests] TEST_DATABASE_URL not set — skipping test-database provisioning. " +
        "See AGENTS.md > Testing Rules to set up Backend/.env.test.local."
    );
    return;
  }

  const { url: testUrl, databaseName } = runTestDatabaseGuard();
  await ensureDatabaseExists(testUrl, databaseName);
  await applySchema(testUrl);
  console.log(`[tests] provisioned throwaway database "${databaseName}" from schema.sql`);
}

async function ensureDatabaseExists(testUrl, databaseName) {
  // Connect to the server's maintenance DB to create the test DB if missing.
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      databaseName,
    ]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${databaseName.replaceAll('"', '""')}"`);
    }
  } finally {
    await client.end();
  }
}

async function applySchema(testUrl) {
  const schemaPath = path.resolve(here, "../../src/models/schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  const client = new pg.Client({ connectionString: testUrl });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}
