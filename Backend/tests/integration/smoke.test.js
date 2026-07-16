import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { pool } from "../../src/config/db.js";
import { resetDb, closePool } from "../helpers/testDb.js";
import { createClient, createLawyer, createAdmin } from "../helpers/factories.js";
import { authHeader } from "../helpers/auth.js";

beforeEach(resetDb);
afterAll(closePool);

describe("integration harness smoke check", () => {
  it("the API answers on /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it("the throwaway database was provisioned from schema.sql (4 roles)", async () => {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM roles`);
    expect(rows[0].count).toBe(4);
  });

  it("factories create users and tokens the API accepts", async () => {
    const client = await createClient();
    const res = await request(app).get("/api/auth/me").set(authHeader(client));
    expect(res.status).toBe(200);
    expect(res.body.user?.email ?? res.body.email).toBeTruthy();
  });

  it("resetDb wipes rows between tests (no leftovers from the previous test)", async () => {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM users`);
    expect(rows[0].count).toBe(0);
  });

  it("role separation works end to end: a client is refused on an admin route", async () => {
    const client = await createClient();
    const admin = await createAdmin();
    const lawyer = await createLawyer();

    const refused = await request(app).get("/api/admin/dashboard-stats").set(authHeader(client));
    expect(refused.status).toBe(403);

    const anonymous = await request(app).get("/api/admin/dashboard-stats");
    expect(anonymous.status).toBe(401);

    const allowed = await request(app).get("/api/admin/dashboard-stats").set(authHeader(admin));
    expect(allowed.status).toBe(200);

    const lawyerCases = await request(app).get("/api/cases").set(authHeader(lawyer));
    expect(lawyerCases.status).toBe(200);
  });
});
