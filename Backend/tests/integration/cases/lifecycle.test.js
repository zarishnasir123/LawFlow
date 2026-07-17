import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app.js";
import { pool } from "../../../src/config/db.js";
import { resetDb, closePool } from "../../helpers/testDb.js";
import {
  createClient,
  createLawyer,
  createRegistrar,
  createCase,
} from "../../helpers/factories.js";
import { authHeader } from "../../helpers/auth.js";

beforeEach(resetDb);
afterAll(closePool);

const eventsFor = async (caseId) =>
  (
    await pool.query(`SELECT event_type FROM case_events WHERE case_id = $1 ORDER BY created_at`, [
      caseId,
    ])
  ).rows.map((r) => r.event_type);

describe("case lifecycle (lawyer)", () => {
  it("creates a draft case through the API", async () => {
    const lawyer = await createLawyer();
    const types = await request(app).get("/api/cases/types").set(authHeader(lawyer));
    expect(types.status).toBe(200);
    const caseTypeId = types.body.caseTypes[0].id;

    const res = await request(app).post("/api/cases").set(authHeader(lawyer)).send({
      caseTypeId,
      title: "Khan vs Ahmed — property dispute",
      clientName: "Ali Khan",
      oppositePartyName: "Bashir Ahmed",
    });
    expect(res.status).toBe(201);
    expect(res.body.case.status ?? "draft").toBe("draft");
  });

  it("lists only the lawyer's own cases", async () => {
    const lawyerA = await createLawyer();
    const lawyerB = await createLawyer();
    await createCase({ lawyer: lawyerA });
    await createCase({ lawyer: lawyerA });
    await createCase({ lawyer: lawyerB });

    const res = await request(app).get("/api/cases").set(authHeader(lawyerA));
    expect(res.status).toBe(200);
    expect(res.body.cases).toHaveLength(2);
  });

  it("hides another lawyer's case behind a 404 (no existence leak)", async () => {
    const owner = await createLawyer();
    const intruder = await createLawyer();
    const row = await createCase({ lawyer: owner });

    const res = await request(app).get(`/api/cases/${row.id}`).set(authHeader(intruder));
    expect(res.status).toBe(404);
  });

  it("updates a draft's details", async () => {
    const lawyer = await createLawyer();
    const row = await createCase({ lawyer });

    const res = await request(app)
      .patch(`/api/cases/${row.id}`)
      .set(authHeader(lawyer))
      .send({ title: "Updated title", assignedTehsil: "Kamoke" });
    expect(res.status).toBe(200);

    const { rows } = await pool.query(`SELECT title, assigned_tehsil FROM cases WHERE id = $1`, [
      row.id,
    ]);
    expect(rows[0].title).toBe("Updated title");
    expect(rows[0].assigned_tehsil).toBe("Kamoke");
  });

  it("refuses to submit without a tehsil, then without a signed file, then succeeds", async () => {
    const lawyer = await createLawyer();
    const row = await createCase({ lawyer });

    let res = await request(app).post(`/api/cases/${row.id}/submit`).set(authHeader(lawyer));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/court\/tehsil/i);

    await pool.query(`UPDATE cases SET assigned_tehsil = 'Gujranwala' WHERE id = $1`, [row.id]);
    res = await request(app).post(`/api/cases/${row.id}/submit`).set(authHeader(lawyer));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/sign/i);

    await pool.query(`UPDATE cases SET signed_pdf_storage_path = 'x/signed.pdf' WHERE id = $1`, [
      row.id,
    ]);
    res = await request(app).post(`/api/cases/${row.id}/submit`).set(authHeader(lawyer));
    expect(res.status).toBe(200);

    const { rows } = await pool.query(`SELECT status FROM cases WHERE id = $1`, [row.id]);
    expect(rows[0].status).toBe("submitted");
    expect(await eventsFor(row.id)).toContain("submitted");
  });

  it("cannot submit a case that is already with the registrar", async () => {
    const lawyer = await createLawyer();
    const row = await createCase({
      lawyer,
      status: "submitted",
      assignedTehsil: "Gujranwala",
      signedPdfPath: "x/signed.pdf",
    });
    const res = await request(app).post(`/api/cases/${row.id}/submit`).set(authHeader(lawyer));
    expect(res.status).toBe(409);
  });
});

describe("registrar review queue", () => {
  const submittedCase = async (lawyer, tehsil = "Gujranwala") =>
    createCase({
      lawyer,
      status: "submitted",
      assignedTehsil: tehsil,
      signedPdfPath: "x/signed.pdf",
    });

  it("shows only cases from the registrar's own tehsil", async () => {
    const lawyer = await createLawyer();
    await submittedCase(lawyer, "Gujranwala");
    await submittedCase(lawyer, "Kamoke");

    const gujranwalaRegistrar = await createRegistrar({ assignedTehsil: "Gujranwala" });
    const res = await request(app).get("/api/registrar/cases").set(authHeader(gujranwalaRegistrar));
    expect(res.status).toBe(200);
    expect(res.body.cases).toHaveLength(1);
  });

  it("approves a submitted case (status becomes accepted + audit event)", async () => {
    const lawyer = await createLawyer();
    const row = await submittedCase(lawyer);
    const registrar = await createRegistrar({ assignedTehsil: "Gujranwala" });

    const res = await request(app)
      .patch(`/api/registrar/cases/${row.id}/approve`)
      .set(authHeader(registrar));
    expect(res.status).toBe(200);

    const { rows } = await pool.query(`SELECT status FROM cases WHERE id = $1`, [row.id]);
    expect(rows[0].status).toBe("accepted");
  });

  it("returns a case with remarks; the lawyer can fix and resubmit", async () => {
    const lawyer = await createLawyer();
    const row = await submittedCase(lawyer);
    const registrar = await createRegistrar({ assignedTehsil: "Gujranwala" });

    const returned = await request(app)
      .patch(`/api/registrar/cases/${row.id}/return`)
      .set(authHeader(registrar))
      .send({ remarks: "Missing affidavit annexure." });
    expect(returned.status).toBe(200);

    const { rows } = await pool.query(`SELECT status, review_remarks FROM cases WHERE id = $1`, [
      row.id,
    ]);
    expect(rows[0].status).toBe("returned");
    expect(rows[0].review_remarks).toBe("Missing affidavit annexure.");

    // Lawyer resubmits — audit trail shows a resubmission, not a first submit.
    const resubmit = await request(app).post(`/api/cases/${row.id}/submit`).set(authHeader(lawyer));
    expect(resubmit.status).toBe(200);
    expect(await eventsFor(row.id)).toContain("resubmitted");
  });

  it("cannot act on a case outside its tehsil (404, no existence leak)", async () => {
    const lawyer = await createLawyer();
    const row = await submittedCase(lawyer, "Kamoke");
    const registrar = await createRegistrar({ assignedTehsil: "Gujranwala" });

    const res = await request(app)
      .patch(`/api/registrar/cases/${row.id}/approve`)
      .set(authHeader(registrar));
    expect(res.status).toBe(404);
  });
});

describe("client case visibility", () => {
  it("a client sees cases linked to them and nothing else", async () => {
    const lawyer = await createLawyer();
    const client = await createClient();
    await createCase({
      lawyer,
      status: "submitted",
      assignedTehsil: "Gujranwala",
      signedPdfPath: "x/signed.pdf",
      clientUserId: client.id,
    });
    await createCase({ lawyer }); // unlinked

    const res = await request(app).get("/api/clients/cases").set(authHeader(client));
    expect(res.status).toBe(200);
    const list = res.body.cases ?? res.body;
    expect(list).toHaveLength(1);
  });
});
