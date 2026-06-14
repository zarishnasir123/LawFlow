import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import hpp from "hpp";

import authRoutes from "./modules/auth/auth.routes.js";
import casesRoutes from "./modules/cases/cases.routes.js";
import clientsRoutes from "./modules/clients/client.routes.js";
import lawyersRoutes from "./modules/lawyers/lawyer.routes.js";
import registrarRoutes from "./modules/registrar/registrar.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import registrarReviewRoutes from "./modules/registrarReview/registrarReview.routes.js";
import notificationRoutes from "./modules/notifications/notifications.routes.js";
import aiRoutes from "./modules/ai/ai.routes.js";
import paymentRoutes from "./modules/payments/serviceCharges.routes.js";
import agreementRoutes from "./modules/payments/agreements.routes.js";
import paymentGatewayRoutes from "./modules/payments/payments.routes.js";
import {
  caseSignatureRoutes,
  mySignatureRoutes,
} from "./modules/signatures/signatures.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";

function resolveCorsOrigins() {
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

app.use(helmet());
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Webhook-Secret", "x-sfpy-signature"]
}));

// 50 MB cap for large file uploads (signatures, etc.)
app.use(express.json({ limit: "50mb" }));
// Parse form posts too — Safepay's signed redirect returns as urlencoded.
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(hpp());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/cases", casesRoutes);
// Client-facing read-only endpoints (role 'client'). GET /api/clients/cases
// returns only the caller client's linked cases.
app.use("/api/clients", clientsRoutes);
app.use("/api/lawyers", lawyersRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payments", agreementRoutes);
// Safepay payment gateway: checkout creation, signed return/cancel, webhook.
app.use("/api/payments", paymentGatewayRoutes);

app.use("/api/cases/:caseId", caseSignatureRoutes);
app.use("/api/me", mySignatureRoutes);
app.use("/api/registrars", registrarRoutes);
// Admin-only aggregate endpoints (dashboard stats, …). Gated by
// authenticate + authorizeRoles('admin') inside the router.
app.use("/api/admin", adminRoutes);
// Registrar-facing case review (role 'registrar'). Singular path —
// distinct from the admin-only /api/registrars management API above.
app.use("/api/registrar", registrarReviewRoutes);
// In-app notifications. Gated by authenticate inside the router; every query
// is scoped to req.user so a user only ever sees / marks their own rows.
app.use("/api/notifications", notificationRoutes);
// Lawyer-only AI legal assistant (Google Gemini, grounded in LawFlow's case
// templates). Gated by authenticate + authorizeRoles('lawyer') inside the router.
app.use("/api/ai", aiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
