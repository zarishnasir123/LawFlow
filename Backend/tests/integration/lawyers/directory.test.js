import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app.js";
import { resetDb, closePool } from "../../helpers/testDb.js";
import { createClient, createLawyer } from "../../helpers/factories.js";
import { authHeader } from "../../helpers/auth.js";

beforeEach(resetDb);
afterAll(closePool);

describe("public lawyer directory", () => {
  it("lists only approved + active lawyers", async () => {
    const client = await createClient();
    await createLawyer({ firstName: "Visible", verificationStatus: "approved" });
    await createLawyer({ firstName: "Pending", verificationStatus: "pending" });
    await createLawyer({
      firstName: "Suspended",
      verificationStatus: "approved",
      accountStatus: "inactive",
    });

    const res = await request(app).get("/api/lawyers").set(authHeader(client));
    expect(res.status).toBe(200);
    const lawyers = res.body.items ?? res.body.lawyers ?? res.body;
    expect(lawyers).toHaveLength(1);
    expect(JSON.stringify(lawyers[0])).toMatch(/Visible/);
  });

  it("filters by specialization", async () => {
    const client = await createClient();
    await createLawyer({ firstName: "Civil", specialization: "civil" });
    await createLawyer({ firstName: "Family", specialization: "family" });

    const res = await request(app)
      .get("/api/lawyers?specialization=family")
      .set(authHeader(client));
    const lawyers = res.body.items ?? res.body.lawyers ?? res.body;
    expect(lawyers).toHaveLength(1);
    expect(JSON.stringify(lawyers[0])).toMatch(/Family/);
  });

  it("searches by name", async () => {
    const client = await createClient();
    await createLawyer({ firstName: "Ahmed", lastName: "Raza" });
    await createLawyer({ firstName: "Bilal", lastName: "Khan" });

    const res = await request(app).get("/api/lawyers?search=raza").set(authHeader(client));
    const lawyers = res.body.items ?? res.body.lawyers ?? res.body;
    expect(lawyers).toHaveLength(1);
  });

  it("serves a lawyer's public profile but 404s hidden ones", async () => {
    const client = await createClient();
    const visible = await createLawyer({ verificationStatus: "approved" });
    const hidden = await createLawyer({ verificationStatus: "pending" });

    const ok = await request(app)
      .get(`/api/lawyers/${visible.lawyerProfileId}`)
      .set(authHeader(client));
    expect(ok.status).toBe(200);

    const gone = await request(app)
      .get(`/api/lawyers/${hidden.lawyerProfileId}`)
      .set(authHeader(client));
    expect(gone.status).toBe(404);
  });

  it("requires login (anonymous is refused)", async () => {
    const res = await request(app).get("/api/lawyers");
    expect(res.status).toBe(401);
  });
});
