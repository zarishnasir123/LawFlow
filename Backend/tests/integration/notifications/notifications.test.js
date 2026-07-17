import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app.js";
import { pool } from "../../../src/config/db.js";
import { resetDb, closePool } from "../../helpers/testDb.js";
import { createClient, createLawyer } from "../../helpers/factories.js";
import { authHeader } from "../../helpers/auth.js";

beforeEach(resetDb);
afterAll(closePool);

async function seedNotification(userId, title = "Case update") {
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, type, title, message)
     VALUES ($1, 'case', $2, 'Your case moved forward.') RETURNING *`,
    [userId]
  ).catch(async () => {
    // type value must satisfy the CHECK constraint — fall back to a known one.
    return pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, 'case', $2, 'Your case moved forward.') RETURNING *`,
      [userId, title]
    );
  });
  return rows[0];
}

describe("notifications", () => {
  it("lists only the caller's notifications", async () => {
    const a = await createClient();
    const b = await createClient();
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message) VALUES
       ($1, 'case', 'A1', 'm'), ($1, 'case', 'A2', 'm'), ($2, 'case', 'B1', 'm')`,
      [a.id, b.id]
    );

    const res = await request(app).get("/api/notifications").set(authHeader(a));
    expect(res.status).toBe(200);
    expect((res.body.notifications ?? res.body).length).toBe(2);
  });

  it("marks a single notification read — but never someone else's", async () => {
    const a = await createClient();
    const b = await createClient();
    const { rows } = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, 'case', 'A1', 'm') RETURNING id`,
      [a.id]
    );

    const own = await request(app)
      .patch(`/api/notifications/${rows[0].id}/read`)
      .set(authHeader(a));
    expect(own.status).toBe(200);
    const { rows: after } = await pool.query(`SELECT is_read FROM notifications WHERE id = $1`, [
      rows[0].id,
    ]);
    expect(after[0].is_read).toBe(true);

    const { rows: rows2 } = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, 'case', 'A2', 'm') RETURNING id`,
      [a.id]
    );
    const foreign = await request(app)
      .patch(`/api/notifications/${rows2[0].id}/read`)
      .set(authHeader(b));
    expect(foreign.status).toBeGreaterThanOrEqual(400);
  });

  it("marks everything read in one call", async () => {
    const a = await createClient();
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message) VALUES
       ($1, 'case', 'A1', 'm'), ($1, 'case', 'A2', 'm')`,
      [a.id]
    );
    const res = await request(app).patch("/api/notifications/read-all").set(authHeader(a));
    expect(res.status).toBe(200);

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id = $1 AND is_read = false`,
      [a.id]
    );
    expect(rows[0].unread).toBe(0);
  });

  it("stores and returns email preferences", async () => {
    const lawyer = await createLawyer();
    const put = await request(app)
      .put("/api/notifications/preferences")
      .set(authHeader(lawyer))
      .send({ emailEnabled: false, hearing: false });
    expect(put.status).toBe(200);

    const get = await request(app).get("/api/notifications/preferences").set(authHeader(lawyer));
    expect(get.status).toBe(200);
    const prefs = get.body.preferences ?? get.body;
    expect(prefs.emailEnabled).toBe(false);
    expect(prefs.hearing).toBe(false);
  });
});
