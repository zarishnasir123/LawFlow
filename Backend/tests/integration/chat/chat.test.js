import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app.js";
import { resetDb, closePool } from "../../helpers/testDb.js";
import { createClient, createLawyer, createRegistrar } from "../../helpers/factories.js";
import { authHeader } from "../../helpers/auth.js";

beforeEach(resetDb);
afterAll(closePool);

async function conversation() {
  const lawyer = await createLawyer();
  const client = await createClient();
  const res = await request(app)
    .post("/api/chat/conversations")
    .set(authHeader(client))
    .send({ lawyerUserId: lawyer.id });
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
  const convo = res.body.conversation ?? res.body;
  return { lawyer, client, conversationId: convo.id };
}

describe("chat (REST)", () => {
  it("a client opens a conversation with a lawyer and messages flow both ways", async () => {
    const { lawyer, client, conversationId } = await conversation();

    const sent = await request(app)
      .post(`/api/chat/conversations/${conversationId}/messages`)
      .set(authHeader(client))
      .send({ text: "Salaam, any update on my case?" });
    expect(sent.status, JSON.stringify(sent.body)).toBeLessThan(300);

    const reply = await request(app)
      .post(`/api/chat/conversations/${conversationId}/messages`)
      .set(authHeader(lawyer))
      .send({ text: "Walaikum salaam — hearing is scheduled for Monday." });
    expect(reply.status).toBeLessThan(300);

    const list = await request(app)
      .get(`/api/chat/conversations/${conversationId}/messages`)
      .set(authHeader(client));
    expect(list.status).toBe(200);
    expect((list.body.messages ?? list.body).length).toBe(2);
  });

  it("a non-participant cannot read the conversation", async () => {
    const { conversationId } = await conversation();
    const outsider = await createClient();
    const res = await request(app)
      .get(`/api/chat/conversations/${conversationId}/messages`)
      .set(authHeader(outsider));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("registrars have no chat at all (role gate on the whole router)", async () => {
    const registrar = await createRegistrar();
    const res = await request(app).get("/api/chat/conversations").set(authHeader(registrar));
    expect(res.status).toBe(403);
  });

  it("reopening the same pair reuses the conversation instead of duplicating it", async () => {
    const { lawyer, client, conversationId } = await conversation();
    const again = await request(app)
      .post("/api/chat/conversations")
      .set(authHeader(client))
      .send({ lawyerUserId: lawyer.id });
    const convo = again.body.conversation ?? again.body;
    expect(convo.id).toBe(conversationId);
  });

  it("marks a conversation read", async () => {
    const { lawyer, client, conversationId } = await conversation();
    await request(app)
      .post(`/api/chat/conversations/${conversationId}/messages`)
      .set(authHeader(lawyer))
      .send({ text: "Update!" });

    const res = await request(app)
      .post(`/api/chat/conversations/${conversationId}/read`)
      .set(authHeader(client));
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
  });
});
