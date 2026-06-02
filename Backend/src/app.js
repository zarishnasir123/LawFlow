import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import hpp from "hpp";

import authRoutes from "./modules/auth/auth.routes.js";
import casesRoutes from "./modules/cases/cases.routes.js";
import lawyersRoutes from "./modules/lawyers/lawyer.routes.js";
import registrarRoutes from "./modules/registrar/registrar.routes.js";
import paymentRoutes from "./modules/payments/serviceCharges.routes.js";
import agreementRoutes from "./modules/payments/agreements.routes.js";
import stripeRoutes from "./modules/payments/stripe.routes.js";
import { handleStripeWebhook } from "./modules/payments/stripe.controller.js";
import { asyncHandler } from "./middleware/asyncHandler.js";
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
  allowedHeaders: ["Content-Type", "Authorization", "X-Webhook-Secret", "stripe-signature"]
}));

// Stripe webhook must be processed with raw body before json parser
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(handleStripeWebhook)
);

// 50 MB cap for large file uploads (signatures, etc.)
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());
app.use(hpp());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/cases", casesRoutes);
app.use("/api/lawyers", lawyersRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payments", agreementRoutes);
// Handle checkout session (not webhook)
app.use("/api/payments", stripeRoutes);

app.use("/api/cases/:caseId", caseSignatureRoutes);
app.use("/api/me", mySignatureRoutes);
app.use("/api/registrars", registrarRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
