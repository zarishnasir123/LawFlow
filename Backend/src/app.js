import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import hpp from "hpp";

import authRoutes from "./modules/auth/auth.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";

function resolveCorsOrigin() {
  const envOrigin = process.env.FRONTEND_URL?.trim();
  if (envOrigin) return envOrigin;
  if (process.env.NODE_ENV === "production") {
    throw new Error("FRONTEND_URL must be set in production for CORS to fail closed");
  }
  return "http://localhost:5173";
}

const app = express();

// Helmet sets common security headers (CSP, X-Frame-Options, HSTS in prod,
// X-Content-Type-Options, Referrer-Policy, etc). Default CSP is appropriate
// for a JSON API — we never serve HTML from this server.
app.use(helmet());
app.use(cors({
  origin: resolveCorsOrigin(),
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Webhook-Secret"]
}));
app.use(express.json({ limit: "1mb" }));
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

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
