import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";

// The final-PDF compile fires after the last signer signs — give it an
// in-memory storage so it succeeds without Supabase.
const uploadedPdfs = [];
vi.mock("../../../src/services/storage.service.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    uploadSignedCasePdf: async (args) => {
      uploadedPdfs.push(args);
      return { storagePath: `signed/${args.caseId}.pdf` };
    },
  };
});

const { default: app } = await import("../../../src/app.js");
const { pool } = await import("../../../src/config/db.js");
const { resetDb, closePool } = await import("../../helpers/testDb.js");
const { createClient, createLawyer, createCase } = await import("../../helpers/factories.js");
const { authHeader } = await import("../../helpers/auth.js");

beforeEach(async () => {
  uploadedPdfs.length = 0;
  await resetDb();
});
afterAll(closePool);

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function caseWithRequest({ signers = ["client", "lawyer"] } = {}) {
  const lawyer = await createLawyer();
  const client = await createClient();
  const caseRow = await createCase({ lawyer, clientUserId: client.id, clientEmail: client.email });

  const res = await request(app)
    .post(`/api/cases/${caseRow.id}/signature-requests`)
    .set(authHeader(lawyer))
    .send({
      clientEmail: client.email,
      pageAssignments: [{ pageIndex: 0, signers }],
      documentHtmlSnapshot: "<section class='docx'><p>Plaint text</p></section>",
    });
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
  return { lawyer, client, caseRow };
}

describe("signature request lifecycle", () => {
  it("creates ONE row per signer sharing a batch (never one row for both)", async () => {
    const { caseRow } = await caseWithRequest();
    const { rows } = await pool.query(
      `SELECT signer_role, case_batch_id FROM signature_requests WHERE case_id = $1`,
      [caseRow.id]
    );
    expect(rows).toHaveLength(2);
    const roles = rows.map((r) => r.signer_role).sort();
    expect(roles).toEqual(["client", "lawyer"]);
    expect(rows[0].case_batch_id).toBe(rows[1].case_batch_id);
  });

  it("the client sees their pending request and can sign it", async () => {
    const { client, caseRow } = await caseWithRequest({ signers: ["client"] });

    const pending = await request(app).get("/api/me/signature-requests").set(authHeader(client));
    expect(pending.status).toBe(200);
    const list = pending.body.signatureRequests ?? pending.body;
    expect(list).toHaveLength(1);
    const requestId = list[0].id;

    const sign = await request(app)
      .post(`/api/me/signature-requests/${requestId}/sign`)
      .set(authHeader(client))
      .send({
        signatureImage: PNG,
        signedPages: [{ pageIndex: 0, imageDataUrl: PNG }],
      });
    expect(sign.status, JSON.stringify(sign.body)).toBeLessThan(300);

    const { rows } = await pool.query(
      `SELECT status FROM signature_requests WHERE case_id = $1`,
      [caseRow.id]
    );
    expect(rows[0].status).toBe("signed");
  });

  it("a stranger cannot see or sign someone else's request", async () => {
    const { caseRow } = await caseWithRequest({ signers: ["client"] });
    const outsider = await createClient();

    const list = await request(app).get("/api/me/signature-requests").set(authHeader(outsider));
    expect((list.body.signatureRequests ?? list.body).length).toBe(0);

    const { rows } = await pool.query(`SELECT id FROM signature_requests WHERE case_id = $1`, [
      caseRow.id,
    ]);
    const steal = await request(app)
      .post(`/api/me/signature-requests/${rows[0].id}/sign`)
      .set(authHeader(outsider))
      .send({ signatureImage: PNG, signedPages: [{ pageIndex: 0, imageDataUrl: PNG }] });
    expect(steal.status).toBeGreaterThanOrEqual(400);
  });

  it("compiles and stamps the signed PDF once the last signer signs", async () => {
    const { lawyer, client, caseRow } = await caseWithRequest();

    for (const signer of [client, lawyer]) {
      const mine = await request(app).get("/api/me/signature-requests").set(authHeader(signer));
      const list = mine.body.signatureRequests ?? mine.body;
      expect(list.length, `${signer.role} should have a pending request`).toBe(1);
      const sign = await request(app)
        .post(`/api/me/signature-requests/${list[0].id}/sign`)
        .set(authHeader(signer))
        .send({ signatureImage: PNG, signedPages: [{ pageIndex: 0, imageDataUrl: PNG }] });
      expect(sign.status, JSON.stringify(sign.body)).toBeLessThan(300);
    }

    // The compile runs on setImmediate after the last signature — give it a beat.
    await new Promise((r) => setTimeout(r, 400));

    const { rows } = await pool.query(
      `SELECT signed_pdf_storage_path FROM cases WHERE id = $1`,
      [caseRow.id]
    );
    expect(rows[0].signed_pdf_storage_path).toBe(`signed/${caseRow.id}.pdf`);
    expect(uploadedPdfs).toHaveLength(1);
  });

  it("refuses a request batch for an unregistered client email", async () => {
    const lawyer = await createLawyer();
    const caseRow = await createCase({ lawyer });
    const res = await request(app)
      .post(`/api/cases/${caseRow.id}/signature-requests`)
      .set(authHeader(lawyer))
      .send({
        clientEmail: "nobody@nowhere.pk",
        pageAssignments: [{ pageIndex: 0, signers: ["client"] }],
        documentHtmlSnapshot: "<section class='docx'><p>x</p></section>",
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.message).toMatch(/client account/i);
  });
});
