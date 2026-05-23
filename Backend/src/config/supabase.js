import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

import { ApiError } from "../utils/apiError.js";

const placeholderValues = new Set([
  "",
  "your_supabase_url",
  "your_supabase_service_role_key",
  "PUT_SUPABASE_URL_HERE",
  "PUT_SUPABASE_SERVICE_ROLE_KEY_HERE"
]);

let cachedClient = null;
let cachedSignature = null;

function isPlaceholder(value) {
  if (!value) return true;
  return placeholderValues.has(value.trim());
}

export function getSupabaseStorageConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_LAWYER_BUCKET || "lawyer-verification-documents";
  // Separate bucket for compiled signed case PDFs — different access
  // rules (lawyer-only) and lifecycle (final artifact, not draft uploads)
  // from the verification-documents bucket, so they don't share a
  // namespace.
  const casePdfBucket = process.env.SUPABASE_CASE_PDF_BUCKET || "case-signed-pdfs";
  const previewUrlExpiresIn = Number(process.env.SUPABASE_PREVIEW_URL_EXPIRES_IN || 900);

  const issues = [];
  if (isPlaceholder(url)) issues.push("SUPABASE_URL");
  if (isPlaceholder(serviceRoleKey)) issues.push("SUPABASE_SERVICE_ROLE_KEY");

  return {
    mode: issues.length === 0 ? "supabase" : "console",
    issues,
    url,
    serviceRoleKey,
    bucket,
    casePdfBucket,
    previewUrlExpiresIn: Number.isFinite(previewUrlExpiresIn) && previewUrlExpiresIn > 0
      ? previewUrlExpiresIn
      : 900
  };
}

export function getSupabaseClient() {
  const config = getSupabaseStorageConfig();

  if (config.mode !== "supabase") {
    return null;
  }

  const signature = `${config.url}::${config.serviceRoleKey}`;

  if (!cachedClient || cachedSignature !== signature) {
    cachedClient = createClient(config.url, config.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          "X-Client-Info": "lawflow-backend"
        }
      },
      realtime: {
        transport: WebSocket
      }
    });
    cachedSignature = signature;
  }

  return cachedClient;
}

export function requireSupabaseClient() {
  const client = getSupabaseClient();

  if (!client) {
    throw new ApiError(503, "Supabase is not configured on this server");
  }

  return client;
}
