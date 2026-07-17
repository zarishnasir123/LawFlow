import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app.js";
import { resetDb, closePool } from "../../helpers/testDb.js";
import { createClient, createLawyer, createCase } from "../../helpers/factories.js";
import { authHeader } from "../../helpers/auth.js";

beforeEach(resetDb);
afterAll(closePool);

async function clientWithSubmittedCase() {
  const lawyer = await createLawyer();
  const client = await createClient();
  await createCase({
    lawyer,
    status: "submitted",
    assignedTehsil: "Gujranwala",
    signedPdfPath: "x/signed.pdf",
    clientUserId: client.id,
  });
  return { lawyer, client };
}

describe("reviews", () => {
  it("a client with a submitted case can review their lawyer", async () => {
    const { lawyer, client } = await clientWithSubmittedCase();
    const res = await request(app).post("/api/reviews").set(authHeader(client)).send({
      lawyerProfileId: lawyer.lawyerProfileId,
      rating: 5,
      comment: "Very professional and responsive.",
    });
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);

    const listed = await request(app)
      .get(`/api/reviews/lawyer/${lawyer.lawyerProfileId}`)
      .set(authHeader(client));
    expect(listed.status).toBe(200);
    const reviews = listed.body.reviews ?? listed.body;
    expect(reviews.length).toBe(1);
    expect(reviews[0].rating).toBe(5);
  });

  it("refuses a review when the client never had a case with that lawyer", async () => {
    const lawyer = await createLawyer();
    const stranger = await createClient();
    const res = await request(app).post("/api/reviews").set(authHeader(stranger)).send({
      lawyerProfileId: lawyer.lawyerProfileId,
      rating: 1,
      comment: "Never met them.",
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.message).toMatch(/submitted case/i);
  });

  it("the lawyer sees received reviews", async () => {
    const { lawyer, client } = await clientWithSubmittedCase();
    await request(app).post("/api/reviews").set(authHeader(client)).send({
      lawyerProfileId: lawyer.lawyerProfileId,
      rating: 4,
    });

    const res = await request(app).get("/api/reviews/received").set(authHeader(lawyer));
    expect(res.status).toBe(200);
    expect((res.body.reviews ?? res.body).length).toBe(1);
  });

  it("a lawyer can report a review", async () => {
    const { lawyer, client } = await clientWithSubmittedCase();
    const created = await request(app).post("/api/reviews").set(authHeader(client)).send({
      lawyerProfileId: lawyer.lawyerProfileId,
      rating: 1,
      comment: "bad",
    });
    const reviewId = (created.body.review ?? created.body).id;

    const res = await request(app)
      .post(`/api/reviews/${reviewId}/report`)
      .set(authHeader(lawyer))
      .send({ reason: "Abusive content" });
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
  });
});
