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
  // Public bucket for client / lawyer / registrar profile pictures. Public
  // because (a) avatars aren't sensitive and the user explicitly chose to
  // display them, and (b) we render them via a plain <img src> on every
  // page header — signed URLs would expire mid-session and break the
  // image. The dev needs to create this bucket in Supabase Studio with
  // "Public bucket" toggled on.
  const avatarBucket = process.env.SUPABASE_AVATAR_BUCKET || "user-avatars";
  // Private bucket for case-editor attachments — images the lawyer
  // drag-drops into the docx editor as floating overlays. Separate
  // from the lawyer-verification bucket because they have a
  // different lifecycle (per-case, not per-lawyer) and a different
  // access path (case ownership check, not lawyer ownership).
  const caseAttachmentBucket =
    process.env.SUPABASE_CASE_ATTACHMENT_BUCKET || "case-attachments";
  // Private bucket for payout transfer receipts (the admin's proof of the
  // manual bank transfer to a lawyer). Its own dedicated bucket, separate from
  // case attachments — different lifecycle and access (admin-only). Each payout
  // also snapshots the bucket it used in payouts.receipt_storage_bucket, so
  // changing this only affects future uploads; old receipts stay resolvable.
  const payoutReceiptBucket =
    process.env.SUPABASE_PAYOUT_RECEIPT_BUCKET || "payout-receipts";
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
    avatarBucket,
    caseAttachmentBucket,
    payoutReceiptBucket,
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
