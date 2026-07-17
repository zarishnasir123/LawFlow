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

const SLOTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00"];
const isWeekend = (dateStr) => [0, 6].includes(new Date(`${dateStr}T00:00:00`).getDay());

async function acceptedCase() {
  const lawyer = await createLawyer();
  const client = await createClient();
  const registrar = await createRegistrar({ assignedTehsil: "Gujranwala" });
  const caseRow = await createCase({
    lawyer,
    status: "accepted",
    assignedTehsil: "Gujranwala",
    signedPdfPath: "x/signed.pdf",
    clientUserId: client.id,
  });
  return { lawyer, client, registrar, caseRow };
}

const propose = (registrar, caseId) =>
  request(app).get(`/api/hearings/cases/${caseId}/propose`).set(authHeader(registrar));

const confirm = (registrar, caseId, slot) =>
  request(app)
    .post(`/api/hearings/cases/${caseId}/confirm`)
    .set(authHeader(registrar))
    .send({
      date: slot.hearingDate,
      startTime: slot.startTime,
      courtroomId: slot.courtroomId,
      hearingType: slot.hearingType ?? "First Appearance / Summons",
    });

describe("slot proposal", () => {
  it("proposes a future weekday slot in a real courtroom at a permitted time", async () => {
    const { registrar, caseRow } = await acceptedCase();
    const res = await propose(registrar, caseRow.id);
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const slot = res.body.proposal;
    expect(SLOTS).toContain(slot.startTime);
    expect(isWeekend(slot.hearingDate)).toBe(false);
    expect(new Date(slot.hearingDate).getTime()).toBeGreaterThan(Date.now() - 86_400_000);

    const { rows } = await pool.query(`SELECT id FROM courtrooms WHERE id = $1`, [slot.courtroomId]);
    expect(rows).toHaveLength(1);
  });

  it("never proposes a date the registrar has declared a holiday", async () => {
    const { registrar, caseRow } = await acceptedCase();
    const first = (await propose(registrar, caseRow.id)).body;
    const firstSlot = first.proposal;

    const holiday = await request(app)
      .post("/api/hearings/holidays")
      .set(authHeader(registrar))
      .send({ date: firstSlot.hearingDate, reason: "Court closure" });
    expect(holiday.status, JSON.stringify(holiday.body)).toBeLessThan(300);

    const second = (await propose(registrar, caseRow.id)).body;
    const secondSlot = second.proposal;
    expect(secondSlot.hearingDate).not.toBe(firstSlot.hearingDate);
  });
});

describe("confirming hearings", () => {
  it("confirms the proposed slot and records the hearing as scheduled", async () => {
    const { registrar, caseRow } = await acceptedCase();
    const slot = (await propose(registrar, caseRow.id)).body.proposal;

    const res = await confirm(registrar, caseRow.id, slot);
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);

    const { rows } = await pool.query(
      `SELECT status, hearing_date::text AS date, start_time::text AS time, courtroom_id
       FROM hearings WHERE case_id = $1`,
      [caseRow.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("scheduled");
    expect(rows[0].date).toBe(slot.hearingDate);
  });

  it("refuses to double-book the same courtroom, date, and time", async () => {
    const first = await acceptedCase();
    const slot = (await propose(first.registrar, first.caseRow.id)).body.proposal;
    await confirm(first.registrar, first.caseRow.id, slot);

    // A second case tries to take the exact same slot.
    const secondCase = await createCase({
      lawyer: await createLawyer(),
      status: "accepted",
      assignedTehsil: "Gujranwala",
      signedPdfPath: "x/signed.pdf",
    });
    const clash = await confirm(first.registrar, secondCase.id, slot);
    expect(clash.status).toBeGreaterThanOrEqual(400);
    expect(clash.status).toBeLessThan(500);

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM hearings
       WHERE courtroom_id = $1 AND hearing_date = $2 AND start_time = $3
         AND status IN ('proposed','scheduled')`,
      [slot.courtroomId, slot.hearingDate, slot.startTime]
    );
    expect(rows[0].count).toBe(1);
  });

  it("reschedules and cancels a hearing", async () => {
    const { registrar, caseRow } = await acceptedCase();
    const slot = (await propose(registrar, caseRow.id)).body.proposal;
    await confirm(registrar, caseRow.id, slot);
    const { rows: created } = await pool.query(`SELECT id FROM hearings WHERE case_id = $1`, [
      caseRow.id,
    ]);
    const hearingId = created[0].id;

    // Move it to the next permitted time on the same day (or another slot time).
    const newTime = SLOTS.find((t) => t !== slot.startTime);
    const rescheduled = await request(app)
      .patch(`/api/hearings/${hearingId}/reschedule`)
      .set(authHeader(registrar))
      .send({ newDate: slot.hearingDate, newStartTime: newTime, newCourtroomId: slot.courtroomId });
    expect(rescheduled.status, JSON.stringify(rescheduled.body)).toBeLessThan(300);

    const cancelled = await request(app)
      .patch(`/api/hearings/${hearingId}/cancel`)
      .set(authHeader(registrar));
    expect(cancelled.status).toBeLessThan(300);

    const { rows } = await pool.query(`SELECT status FROM hearings WHERE id = $1`, [hearingId]);
    expect(rows[0].status).toBe("cancelled");
  });

  it("records an outcome on a scheduled hearing", async () => {
    const { registrar, caseRow } = await acceptedCase();
    const slot = (await propose(registrar, caseRow.id)).body.proposal;
    await confirm(registrar, caseRow.id, slot);
    const { rows: created } = await pool.query(`SELECT id FROM hearings WHERE case_id = $1`, [
      caseRow.id,
    ]);

    const res = await request(app)
      .post(`/api/hearings/${created[0].id}/outcome`)
      .set(authHeader(registrar))
      .send({ outcome: "completed", remarks: "Both parties appeared." });
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);

    const { rows } = await pool.query(`SELECT status FROM hearings WHERE id = $1`, [created[0].id]);
    expect(rows[0].status).toBe("completed");
  });
});

describe("visibility", () => {
  it("the lawyer and the linked client both see the scheduled hearing", async () => {
    const { lawyer, client, registrar, caseRow } = await acceptedCase();
    const slot = (await propose(registrar, caseRow.id)).body.proposal;
    await confirm(registrar, caseRow.id, slot);

    const lawyerView = await request(app).get("/api/hearings/my").set(authHeader(lawyer));
    expect(lawyerView.status).toBe(200);
    expect((lawyerView.body.hearings ?? lawyerView.body).length).toBe(1);

    const clientView = await request(app).get("/api/hearings/my/client").set(authHeader(client));
    expect(clientView.status).toBe(200);
    expect((clientView.body.hearings ?? clientView.body).length).toBe(1);
  });
});

describe("holiday management", () => {
  it("adds, lists, and deletes holidays", async () => {
    const registrar = await createRegistrar();
    const add = await request(app)
      .post("/api/hearings/holidays")
      .set(authHeader(registrar))
      .send({ date: "2027-03-23", reason: "Pakistan Day" });
    expect(add.status, JSON.stringify(add.body)).toBeLessThan(300);

    const list = await request(app).get("/api/hearings/holidays").set(authHeader(registrar));
    const holidays = list.body.holidays ?? list.body;
    const added = holidays.find((h) => String(h.date).startsWith("2027-03-23"));
    expect(added).toBeTruthy();

    const del = await request(app)
      .delete(`/api/hearings/holidays/${added.id}`)
      .set(authHeader(registrar));
    expect(del.status).toBeLessThan(300);
  });
});
