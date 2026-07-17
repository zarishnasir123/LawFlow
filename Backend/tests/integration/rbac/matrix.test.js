import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app.js";
import { resetDb, closePool } from "../../helpers/testDb.js";
import {
  createClient,
  createLawyer,
  createRegistrar,
  createAdmin,
} from "../../helpers/factories.js";
import { authHeader } from "../../helpers/auth.js";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

// ── Route discovery ──────────────────────────────────────────────────
// Walk Express's internal router stack so EVERY registered route is
// probed automatically — a new endpoint added without `authenticate`
// fails this suite the moment it exists.
function mountPathOf(layer) {
  return (
    layer.regexp.source
      .replace("\\/?(?=\\/|$)", "")
      .replace(/^\^/, "")
      .replace(/\$$/, "")
      .replace(/\\\//g, "/")
      // A mounted param (app.use("/api/cases/:caseId", …)) appears in the
      // regexp as a capture group — turn it back into a path segment.
      .replace(/\(\?:\/\(\[\^\/]\+\?\)\)/g, "/:param")
  );
}

function listRoutes(stack, prefix = "") {
  const routes = [];
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        if (method === "_all") continue;
        routes.push({ method: method.toUpperCase(), path: prefix + layer.route.path });
      }
    } else if (layer.name === "router" && layer.handle?.stack) {
      routes.push(...listRoutes(layer.handle.stack, prefix + mountPathOf(layer)));
    }
  }
  return routes;
}

// Endpoints that are MEANT to work without a login. Everything else on
// /api must answer 401 to an anonymous request.
const PUBLIC_ROUTES = new Set([
  "POST /api/auth/register/client",
  "POST /api/auth/register/lawyer",
  "POST /api/auth/login",
  "POST /api/auth/refresh",
  "POST /api/auth/verify-email",
  "POST /api/auth/resend-verification-otp",
  "POST /api/auth/forgot-password",
  "POST /api/auth/reset-password",
  "POST /api/auth/logout",
  "POST /api/auth/reactivate",
  "GET /api/auth/google",
  "POST /api/auth/google/session",
  "POST /api/auth/webhooks/supabase",
  "GET /api/lawyers",
  "GET /api/lawyers/:lawyerProfileId",
  "GET /api/lawyers/:lawyerProfileId/reviews",
  "GET /api/lawyers/:lawyerProfileId/case-charges",
  // Safepay-facing endpoints: intentionally unauthenticated — trust is the
  // gateway signature verified inside each handler (see payments.routes.js).
  "POST /api/payments/confirm",
  "POST /api/payments/webhook",
]);

const probePath = (path) => path.replace(/:[^/]+/g, UUID);

beforeAll(async () => {
  await resetDb();
});
afterAll(closePool);

describe("RBAC matrix", () => {
  it(
    "every /api route outside the public list refuses anonymous requests with 401",
    async () => {
      const routes = listRoutes(app._router.stack).filter((r) => r.path.startsWith("/api"));
      expect(routes.length).toBeGreaterThan(100); // sanity: discovery worked

      const offenders = [];
      for (const route of routes) {
        const key = `${route.method} ${route.path}`;
        if (PUBLIC_ROUTES.has(key)) continue;
        const res = await request(app)[route.method.toLowerCase()](probePath(route.path));
        if (res.status !== 401) {
          offenders.push(`${key} -> ${res.status}`);
        }
      }
      expect(offenders, `routes reachable without login:\n${offenders.join("\n")}`).toEqual([]);
    },
    120_000
  );

  it(
    "role gates hold: each sensitive route family rejects every wrong role with 403",
    async () => {
      const actors = {
        client: await createClient(),
        lawyer: await createLawyer(),
        registrar: await createRegistrar(),
        admin: await createAdmin(),
      };

      // { method, path, allowed } — curated, security-critical picks from
      // every role-gated router. "allowed" roles must NOT get 401/403;
      // everyone else must get exactly 403.
      const MATRIX = [
        // Admin panel
        { method: "GET", path: "/api/admin/dashboard-stats", allowed: ["admin"] },
        { method: "GET", path: "/api/admin/money/overview", allowed: ["admin"] },
        { method: "GET", path: "/api/admin/payouts", allowed: ["admin"] },
        { method: "PATCH", path: `/api/admin/payouts/${UUID}`, allowed: ["admin"] },
        { method: "PUT", path: "/api/admin/commission-rate", allowed: ["admin"] },
        { method: "GET", path: "/api/admin/statistics", allowed: ["admin"] },
        // Admin-only lawyer review + registrar management (auth router)
        { method: "GET", path: "/api/auth/lawyers/pending", allowed: ["admin"] },
        { method: "PATCH", path: `/api/auth/lawyers/${UUID}/review`, allowed: ["admin"] },
        { method: "PATCH", path: `/api/auth/lawyers/${UUID}/suspend`, allowed: ["admin"] },
        { method: "POST", path: `/api/auth/lawyers/${UUID}/verify-cnic`, allowed: ["admin"] },
        // Registrar CRUD (admin-only) + registrar case queue
        { method: "POST", path: "/api/registrars", allowed: ["admin"] },
        { method: "GET", path: "/api/registrars", allowed: ["admin"] },
        { method: "GET", path: "/api/registrar/cases", allowed: ["registrar"] },
        { method: "POST", path: `/api/registrar/cases/${UUID}/return`, allowed: ["registrar"] },
        // Lawyer-only surfaces
        { method: "POST", path: "/api/cases", allowed: ["lawyer"] },
        { method: "POST", path: "/api/ai/guidance", allowed: ["lawyer"] },
        { method: "GET", path: "/api/payments/lawyer/payout-account", allowed: ["lawyer"] },
        { method: "POST", path: "/api/payments/lawyer/request-payout", allowed: ["lawyer"] },
        // Client-only surfaces
        { method: "GET", path: "/api/clients/cases", allowed: ["client"] },
      ];

      const failures = [];
      for (const entry of MATRIX) {
        for (const [role, user] of Object.entries(actors)) {
          const res = await request(app)
            [entry.method.toLowerCase()](entry.path)
            .set(authHeader(user));
          const isAllowed = entry.allowed.includes(role);
          if (isAllowed && (res.status === 401 || res.status === 403)) {
            failures.push(`${entry.method} ${entry.path}: ${role} should be allowed, got ${res.status}`);
          }
          if (!isAllowed && res.status !== 403) {
            failures.push(`${entry.method} ${entry.path}: ${role} should get 403, got ${res.status}`);
          }
        }
      }
      expect(failures, failures.join("\n")).toEqual([]);
    },
    120_000
  );
});
