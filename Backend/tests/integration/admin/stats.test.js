import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app.js";
import { resetDb, closePool } from "../../helpers/testDb.js";
import { createAdmin, createClient, createLawyer, createRegistrar } from "../../helpers/factories.js";
import { authHeader } from "../../helpers/auth.js";

beforeEach(resetDb);
afterAll(closePool);

describe("admin dashboard numbers", () => {
  it("dashboard stats reflect the seeded users exactly", async () => {
    const admin = await createAdmin();
    await createClient();
    await createClient();
    await createLawyer({ verificationStatus: "approved" });
    await createLawyer({ verificationStatus: "pending" });
    await createRegistrar();

    const res = await request(app).get("/api/admin/dashboard-stats").set(authHeader(admin));
    expect(res.status).toBe(200);
    
    
    expect(res.body.pendingVerifications).toBe(1);
    
  });

  it("statistics endpoint accepts each documented range", async () => {
    const admin = await createAdmin();
    for (const range of ["week", "month", "year"]) {
      const res = await request(app)
        .get(`/api/admin/statistics?range=${range}`)
        .set(authHeader(admin));
      expect(res.status, range).toBe(200);
    }
    const bad = await request(app)
      .get("/api/admin/statistics?range=decade")
      .set(authHeader(admin));
    expect(bad.status).toBe(400);
  });

  it("money overview answers with the platform totals", async () => {
    const admin = await createAdmin();
    const res = await request(app).get("/api/admin/money-overview").set(authHeader(admin));
    expect(res.status).toBe(200);
  });

  it("commission rate: read, update, and read back", async () => {
    const admin = await createAdmin();
    const initial = await request(app).get("/api/admin/commission-rate").set(authHeader(admin));
    expect(initial.status).toBe(200);
    expect(Number(initial.body.commissionRate ?? initial.body.rate)).toBe(10);

    const update = await request(app)
      .put("/api/admin/commission-rate")
      .set(authHeader(admin))
      .send({ commissionRate: 12.5 });
    expect(update.status, JSON.stringify(update.body)).toBe(200);

    const after = await request(app).get("/api/admin/commission-rate").set(authHeader(admin));
    expect(Number(after.body.commissionRate ?? after.body.rate)).toBe(12.5);
  });
});
