import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";

// ── Email capture ────────────────────────────────────────────────────
// OTPs and reset tokens are stored HASHED, so the only way a test can
// read them is to catch them at send time. Plain closure store.
const sentEmails = [];
vi.mock("../../../src/services/email.service.js", async (importOriginal) => {
  const actual = await importOriginal();
  // Return the same delivery-status shape the real functions produce —
  // registration reads .emailSent / .emailQueued off it.
  const QUEUED = { queued: true, emailSent: false, emailQueued: true, deliveryMode: "console" };
  const SENT = { queued: false, emailSent: true, emailQueued: false, deliveryMode: "smtp" };
  const capture = (type) => (args) => {
    sentEmails.push({ type, ...args });
    return QUEUED;
  };
  const captureAsync = (type) => async (args) => {
    sentEmails.push({ type, ...args });
    return SENT;
  };
  return {
    ...actual,
    sendVerificationOtpEmail: captureAsync("otp"),
    deliverVerificationOtpEmail: captureAsync("otp"),
    queueVerificationOtpEmail: capture("otp"),
    queueWelcomeEmail: capture("welcome"),
    sendWelcomeEmail: captureAsync("welcome"),
    queueLawyerPendingReviewEmail: capture("lawyerPending"),
    sendPasswordResetEmail: captureAsync("reset"),
    queuePasswordResetEmail: capture("reset"),
    queuePasswordResetGoogleUserEmail: capture("resetGoogle"),
  };
});

// Registration validators do a LIVE DNS MX lookup — always mock it.
vi.mock("../../../src/utils/email.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, canEmailDomainReceiveMail: async () => true };
});

const { default: app } = await import("../../../src/app.js");
const { pool } = await import("../../../src/config/db.js");
const { resetDb, closePool } = await import("../../helpers/testDb.js");
const { createClient } = await import("../../helpers/factories.js");

let cnicSeq = 1000000;
const registrationBody = (overrides = {}) => ({
  firstName: "Areeba",
  lastName: "Khan",
  email: `areeba-${cnicSeq}@gmail.com`,
  phone: "+92-300-1234567",
  cnic: `34101-${cnicSeq++}-1`,
  password: "Passw0rd!",
  confirmPassword: "Passw0rd!",
  ...overrides,
});

const lastOtpFor = (email) =>
  [...sentEmails].reverse().find((e) => e.type === "otp" && e.email === email)?.otp;

const lastResetUrlFor = (email) =>
  [...sentEmails].reverse().find((e) => e.type === "reset" && e.email === email)?.resetUrl;

beforeEach(async () => {
  await resetDb();
  sentEmails.length = 0;
});
afterAll(closePool);

describe("client registration + email verification", () => {
  it("registers, emails a 6-digit OTP, verifies, and can then log in", async () => {
    const body = registrationBody();

    const register = await request(app).post("/api/auth/register/client").send(body);
    expect(register.status).toBe(201);

    const otp = lastOtpFor(body.email);
    expect(otp).toMatch(/^\d{6}$/);

    const verify = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: body.email, otp });
    expect(verify.status).toBe(200);

    // The user row now exists, verified and active.
    const { rows } = await pool.query(
      `SELECT email_verified, account_status FROM users WHERE email = $1`,
      [body.email]
    );
    expect(rows[0].email_verified).toBe(true);
    expect(rows[0].account_status).toBe("active");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: body.email, password: body.password });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();
  });

  it("rejects a wrong OTP and does not create the user", async () => {
    const body = registrationBody();
    await request(app).post("/api/auth/register/client").send(body);

    const otp = lastOtpFor(body.email);
    const wrongOtp = otp === "111111" ? "222222" : "111111";

    const verify = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: body.email, otp: wrongOtp });
    expect(verify.status).toBeGreaterThanOrEqual(400);

    const { rows } = await pool.query(`SELECT id FROM users WHERE email = $1`, [body.email]);
    expect(rows).toHaveLength(0);
  });

  it("cannot log in before verifying the email", async () => {
    const body = registrationBody();
    await request(app).post("/api/auth/register/client").send(body);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: body.email, password: body.password });
    expect(login.status).toBeGreaterThanOrEqual(400);
  });

  it("resends a fresh OTP that verifies successfully", async () => {
    const body = registrationBody();
    await request(app).post("/api/auth/register/client").send(body);

    const resend = await request(app)
      .post("/api/auth/resend-verification-otp")
      .send({ email: body.email });
    expect(resend.status).toBe(200);

    const freshOtp = lastOtpFor(body.email);
    const verify = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: body.email, otp: freshOtp });
    expect(verify.status).toBe(200);
  });

  it("refuses to register an email that already belongs to a user", async () => {
    const existing = await createClient({ email: "taken@gmail.com" });
    const res = await request(app)
      .post("/api/auth/register/client")
      .send(registrationBody({ email: existing.email }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("refuses a duplicate CNIC even with a different email", async () => {
    await createClient({ email: "first@gmail.com", cnic: "34101-9999999-1" });
    const res = await request(app)
      .post("/api/auth/register/client")
      .send(registrationBody({ cnic: "34101-9999999-1" }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe("forgot / reset password", () => {
  it("emails a reset link whose token actually resets the password", async () => {
    const user = await createClient({ email: "resetme@gmail.com" });

    const forgot = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: user.email });
    expect(forgot.status).toBe(200);

    const resetUrl = lastResetUrlFor(user.email);
    expect(resetUrl).toBeTruthy();
    const token = /token=([a-f0-9]{64})/.exec(resetUrl)?.[1];
    expect(token).toBeTruthy();

    const reset = await request(app).post("/api/auth/reset-password").send({
      token,
      password: "NewPassw0rd!",
      confirmPassword: "NewPassw0rd!",
    });
    expect(reset.status).toBe(200);

    // Old password dead, new password works.
    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "Password1!" });
    expect(oldLogin.status).toBeGreaterThanOrEqual(400);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "NewPassw0rd!" });
    expect(newLogin.status).toBe(200);
  });

  it("a reset token can only be used once", async () => {
    const user = await createClient({ email: "once@gmail.com" });
    await request(app).post("/api/auth/forgot-password").send({ email: user.email });
    const token = /token=([a-f0-9]{64})/.exec(lastResetUrlFor(user.email))?.[1];

    const first = await request(app).post("/api/auth/reset-password").send({
      token,
      password: "NewPassw0rd!",
      confirmPassword: "NewPassw0rd!",
    });
    expect(first.status).toBe(200);

    const second = await request(app).post("/api/auth/reset-password").send({
      token,
      password: "OtherPass1!",
      confirmPassword: "OtherPass1!",
    });
    expect(second.status).toBeGreaterThanOrEqual(400);
  });

  it("answers 200 for an unknown email without sending anything (no account enumeration)", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "who-is-this@gmail.com" });
    expect(res.status).toBe(200);
    expect(lastResetUrlFor("who-is-this@gmail.com")).toBeUndefined();
  });
});
