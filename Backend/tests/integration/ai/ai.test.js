import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";

// Never call a real LLM: both providers are faked at the service seam.
vi.mock("../../../src/services/groq.service.js", () => ({
  generateGroqText: async () => "Mocked guidance: under the Family Courts Act…",
  isGroqConfigured: () => true,
}));
vi.mock("../../../src/services/gemini.service.js", () => ({
  generateGeminiText: async () => "Mocked guidance (gemini).",
  generateGeminiVision: async () => "NOT_FOUND",
  isGeminiConfigured: () => false,
}));

const { default: app } = await import("../../../src/app.js");
const { pool } = await import("../../../src/config/db.js");
const { resetDb, closePool } = await import("../../helpers/testDb.js");
const { createLawyer } = await import("../../helpers/factories.js");
const { authHeader } = await import("../../helpers/auth.js");

beforeEach(resetDb);
afterAll(closePool);

describe("AI legal assistant (lawyer-only)", () => {
  it("answers a prompt with the mocked provider and persists the conversation", async () => {
    const lawyer = await createLawyer();
    const res = await request(app)
      .post("/api/ai/guidance")
      .set(authHeader(lawyer))
      .send({ prompt: "What are the grounds for khula?" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(JSON.stringify(res.body)).toMatch(/Mocked guidance/);

    const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM ai_chat_messages`);
    expect(rows[0].count).toBe(2); // the question + the answer
  });

  it("continues an existing session instead of opening a new one", async () => {
    const lawyer = await createLawyer();
    const first = await request(app)
      .post("/api/ai/guidance")
      .set(authHeader(lawyer))
      .send({ prompt: "Question one" });
    const sessionId = first.body.sessionId ?? first.body.session?.id;
    expect(sessionId).toBeTruthy();

    await request(app)
      .post("/api/ai/guidance")
      .set(authHeader(lawyer))
      .send({ prompt: "Question two", sessionId });

    const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM ai_chat_sessions`);
    expect(rows[0].count).toBe(1);
    const { rows: msgs } = await pool.query(`SELECT COUNT(*)::int AS count FROM ai_chat_messages`);
    expect(msgs[0].count).toBe(4);
  });

  it("keeps sessions private to their lawyer", async () => {
    const owner = await createLawyer();
    const other = await createLawyer();
    await request(app).post("/api/ai/guidance").set(authHeader(owner)).send({ prompt: "Mine" });

    const res = await request(app).get("/api/ai/sessions").set(authHeader(other));
    expect(res.status).toBe(200);
    expect((res.body.sessions ?? res.body).length).toBe(0);
  });

  it("polishes selected text with the mocked provider", async () => {
    const lawyer = await createLawyer();
    const res = await request(app)
      .post("/api/ai/polish")
      .set(authHeader(lawyer))
      .send({ mode: "grammar", text: "this sentence are wrong" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  });
});
