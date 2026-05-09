import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

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
    previewUrlExpiresIn: Number.isFinite(previewUrlExpiresIn) && previewUrlExpiresIn > 0
      ? previewUrlExpiresIn
      : 900
  };
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        "X-Client-Info": "lawflow-backend",
      },
    },
    realtime: {
      transport: WebSocket,
    },
  }
);
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
      realtime: {
        transport: WebSocket
      }
    });
    cachedSignature = signature;
  }

  return cachedClient;
}
