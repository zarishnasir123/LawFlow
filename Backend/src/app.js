import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import hpp from "hpp";

import authRoutes from "./modules/auth/auth.routes.js";
import casesRoutes from "./modules/cases/cases.routes.js";
import lawyersRoutes from "./modules/lawyers/lawyer.routes.js";
import registrarRoutes from "./modules/registrar/registrar.routes.js";
import {
  caseSignatureRoutes,
  mySignatureRoutes,
} from "./modules/signatures/signatures.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";

function resolveCorsOrigins() {
  // FRONTEND_URLS supports a comma-separated list so the same backend can
  // serve both the main app (:5173) and the standalone admin panel (:5174).
  // FRONTEND_URL is kept as a single-origin fallback for backwards compat.
  const envList = process.env.FRONTEND_URLS?.trim();
  if (envList) {
    return envList.split(",").map((s) => s.trim()).filter(Boolean);
  }
  const envSingle = process.env.FRONTEND_URL?.trim();
  if (envSingle) return [envSingle];
  if (process.env.NODE_ENV === "production") {
    throw new Error("FRONTEND_URLS must be set in production for CORS to fail closed");
  }
  return ["http://localhost:5173", "http://localhost:5174"];
}

const allowedOrigins = resolveCorsOrigins();

const app = express();

// Helmet sets common security headers (CSP, X-Frame-Options, HSTS in prod,
// X-Content-Type-Options, Referrer-Policy, etc). Default CSP is appropriate
// for a JSON API — we never serve HTML from this server.
app.use(helmet());
app.use(cors({
  origin(origin, cb) {
    // Same-origin / non-browser requests (curl, server-to-server) send no
    // Origin header — allow them; CORS only protects browser-driven calls.
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Webhook-Secret"]
}));
// 50 MB cap so the signature submit endpoint can receive multi-page
// html2canvas captures (one A4 PNG at devicePixelRatio=2 is ~400–800 KB;
// a 50-page submission could approach 40 MB). Validators in
// signatures.validators.js enforce a per-page and per-array cap as a
// finer-grained second line of defence — the express limit only stops
// pathological global payloads from chewing memory before validation
// runs.
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());
// hpp protects against HTTP Parameter Pollution: a malicious caller sending
// ?role=client&role=admin would otherwise let req.query.role be an array.
// hpp keeps the last value, which makes downstream code that expects a
// string safe.
app.use(hpp());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/cases", casesRoutes);
app.use("/api/lawyers", lawyersRoutes);
// Signature endpoints scoped to a case live under /api/cases/:caseId/...
// so case ownership can be enforced through the join in the service
// layer. The mergeParams option on the router lets the nested route
// see :caseId from the parent mount.
app.use("/api/cases/:caseId", caseSignatureRoutes);
// Recipient-side signature endpoints — authenticated as the signer
// (client OR lawyer). Each row's recipient_user_id is the auth target,
// so the same handlers serve both roles without role-based middleware.
app.use("/api/me", mySignatureRoutes);
app.use("/api/registrars", registrarRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
