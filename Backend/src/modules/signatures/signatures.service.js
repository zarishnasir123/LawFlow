import crypto from "node:crypto";

import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";

// Plaintext tokens are URL-safe base64 of 32 random bytes — 43 chars,
// 256 bits of entropy. We hash with SHA-256 before storing (same pattern
// as auth_sessions.refresh_token_hash) so a DB leak can't be used to
// sign documents. The lawyer only ever sees the plaintext once, in the
// link returned from the create endpoint.
const TOKEN_BYTES = 32;
const TOKEN_HASH_ALGO = "sha256";

// Signature requests expire 14 days after creation. Long enough for a
// client to get around to signing, short enough that stale links don't
// hang around forever. Tweak via env if needed later.
const DEFAULT_TTL_DAYS = 14;

function mintToken() {
  const raw = crypto.randomBytes(TOKEN_BYTES);
  const plaintext = raw.toString("base64url");
  const hash = crypto
    .createHash(TOKEN_HASH_ALGO)
    .update(plaintext)
    .digest("hex");
  return { plaintext, hash };
}

function hashToken(plaintext) {
  return crypto
    .createHash(TOKEN_HASH_ALGO)
    .update(plaintext)
    .digest("hex");
}

function mapSignatureRequest(row, { includeSnapshot = false } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    caseId: row.case_id,
    createdByUserId: row.created_by_user_id,
    recipientEmail: row.recipient_email,
    recipientName: row.recipient_name,
    pageIndices: row.page_indices,
    requiresClientSignature: row.requires_client_signature,
    requiresLawyerSignature: row.requires_lawyer_signature,
    clientSignedAt: row.client_signed_at,
    lawyerSignedAt: row.lawyer_signed_at,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Signature images themselves can be large (base64) and only the
    // signing page + the lawyer's review screen need them. Callers opt
    // in explicitly so list endpoints don't transmit ~50KB of base64
    // per row.
    ...(includeSnapshot
      ? {
          documentHtmlSnapshot: row.document_html_snapshot,
          clientSignatureImage: row.client_signature_image,
          lawyerSignatureImage: row.lawyer_signature_image,
        }
      : {}),
  };
}

function computeStatus({
  requiresClientSignature,
  requiresLawyerSignature,
  clientSignedAt,
  lawyerSignedAt,
}) {
  const clientDone = !requiresClientSignature || Boolean(clientSignedAt);
  const lawyerDone = !requiresLawyerSignature || Boolean(lawyerSignedAt);
  if (clientDone && lawyerDone) return "fully_signed";
  if (clientSignedAt || lawyerSignedAt) return "partially_signed";
  return "pending";
}

// Lawyer-owned case lookup. Returns the row only when the requesting
// lawyer actually owns the case, so the rest of the service can trust
// the case_id it gets without re-running the ownership check.
async function findCaseForLawyer(caseId, lawyerUserId) {
  const result = await pool.query(
    `SELECT id, lawyer_user_id, edited_html
     FROM cases
     WHERE id = $1 AND lawyer_user_id = $2`,
    [caseId, lawyerUserId]
  );
  return result.rows[0] || null;
}

// Save the lawyer's working HTML state for a case. Called by the editor
// any time the lawyer pauses typing (debounced) or hits Save Draft.
// Returns the updated_at timestamp so the editor can display a "Saved
// 2m ago" indicator.
export async function saveEditedDocument({
  caseId,
  lawyerUserId,
  editedHtml,
}) {
  const existing = await findCaseForLawyer(caseId, lawyerUserId);
  if (!existing) {
    throw new ApiError(404, "Case not found");
  }

  const result = await pool.query(
    `UPDATE cases
     SET edited_html = $1,
         updated_at = NOW()
     WHERE id = $2 AND lawyer_user_id = $3
     RETURNING updated_at`,
    [editedHtml, caseId, lawyerUserId]
  );

  return { updatedAt: result.rows[0].updated_at };
}

// Lawyer-side: create a new signature request, freezing the document
// HTML snapshot the recipient will see. Returns the plaintext token in
// the response so the caller can build a signing URL and email it; the
// token is never returned again.
export async function createSignatureRequest({
  caseId,
  lawyerUserId,
  recipientEmail,
  recipientName,
  documentHtmlSnapshot,
  pageIndices,
  requiresClientSignature,
  requiresLawyerSignature,
  ttlDays = DEFAULT_TTL_DAYS,
}) {
  const existing = await findCaseForLawyer(caseId, lawyerUserId);
  if (!existing) {
    throw new ApiError(404, "Case not found");
  }

  if (!requiresClientSignature && !requiresLawyerSignature) {
    throw new ApiError(
      400,
      "At least one of client or lawyer signature must be required"
    );
  }

  const { plaintext, hash } = mintToken();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const result = await pool.query(
    `INSERT INTO signature_requests (
       case_id,
       created_by_user_id,
       recipient_email,
       recipient_name,
       document_html_snapshot,
       page_indices,
       token_hash,
       requires_client_signature,
       requires_lawyer_signature,
       expires_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      caseId,
      lawyerUserId,
      recipientEmail,
      recipientName || null,
      documentHtmlSnapshot,
      pageIndices ? JSON.stringify(pageIndices) : null,
      hash,
      requiresClientSignature,
      requiresLawyerSignature,
      expiresAt,
    ]
  );

  return {
    request: mapSignatureRequest(result.rows[0]),
    token: plaintext, // shown to the caller once
  };
}

// Lawyer-side: list every signature request on a case. Used by the
// editor sidebar's poll loop to refresh per-page signature badges.
export async function listSignatureRequestsForCase({ caseId, lawyerUserId }) {
  const ownership = await findCaseForLawyer(caseId, lawyerUserId);
  if (!ownership) throw new ApiError(404, "Case not found");

  const result = await pool.query(
    `SELECT *
     FROM signature_requests
     WHERE case_id = $1
     ORDER BY created_at DESC`,
    [caseId]
  );

  return result.rows.map((row) => mapSignatureRequest(row));
}

// Public side: fetch a signature request by its plaintext token. Hashes
// the token and looks up the row. Returns the snapshot HTML so the
// public signing page can render the doc. Refuses if the request is
// expired or cancelled.
export async function getSignatureRequestByToken(token) {
  if (!token || typeof token !== "string") {
    throw new ApiError(404, "Signature request not found");
  }
  const tokenHash = hashToken(token);

  const result = await pool.query(
    `SELECT * FROM signature_requests WHERE token_hash = $1`,
    [tokenHash]
  );
  const row = result.rows[0];
  if (!row) {
    throw new ApiError(404, "Signature request not found");
  }

  // Mark expired-by-time lazily on read so we don't need a cron job for
  // the FYP. Cancelled requests stay cancelled.
  let effectiveStatus = row.status;
  if (
    effectiveStatus !== "fully_signed" &&
    effectiveStatus !== "cancelled" &&
    row.expires_at < new Date()
  ) {
    effectiveStatus = "expired";
  }

  if (effectiveStatus === "expired") {
    throw new ApiError(410, "This signing link has expired");
  }
  if (effectiveStatus === "cancelled") {
    throw new ApiError(410, "This signature request was cancelled");
  }

  return mapSignatureRequest(row, { includeSnapshot: true });
}

// Public side: client submits their signature. We accept the signature
// image as a base64-encoded PNG data URL and store it directly. After
// updating, recompute the status (partial / full) and return the new
// state so the client UI can show "Thank you, fully signed!".
export async function submitClientSignature({ token, signatureImage }) {
  if (!signatureImage || typeof signatureImage !== "string") {
    throw new ApiError(400, "Signature image is required");
  }
  if (!signatureImage.startsWith("data:image/")) {
    throw new ApiError(400, "Signature must be a base64 image data URL");
  }

  const tokenHash = hashToken(token);
  const existing = await pool.query(
    `SELECT * FROM signature_requests WHERE token_hash = $1`,
    [tokenHash]
  );
  const row = existing.rows[0];
  if (!row) throw new ApiError(404, "Signature request not found");

  if (row.status === "cancelled" || row.expires_at < new Date()) {
    throw new ApiError(410, "This signing link is no longer active");
  }
  if (!row.requires_client_signature) {
    throw new ApiError(400, "This request does not require a client signature");
  }
  if (row.client_signed_at) {
    throw new ApiError(409, "This request has already been signed by the client");
  }

  const nextStatus = computeStatus({
    requiresClientSignature: row.requires_client_signature,
    requiresLawyerSignature: row.requires_lawyer_signature,
    clientSignedAt: new Date(),
    lawyerSignedAt: row.lawyer_signed_at,
  });

  const updated = await pool.query(
    `UPDATE signature_requests
     SET client_signature_image = $1,
         client_signed_at = NOW(),
         status = $2,
         updated_at = NOW()
     WHERE token_hash = $3
     RETURNING *`,
    [signatureImage, nextStatus, tokenHash]
  );

  return mapSignatureRequest(updated.rows[0]);
}

// Lawyer-side: cancel an in-flight signature request. Useful when the
// lawyer realises they sent the wrong document and wants to invalidate
// the link immediately.
export async function cancelSignatureRequest({
  requestId,
  lawyerUserId,
}) {
  // Two-step: confirm the lawyer owns the case the request belongs to
  // before mutating. Skipping this would let any authenticated lawyer
  // cancel any request — a horizontal-privilege bug.
  const owned = await pool.query(
    `SELECT sr.id, sr.status
     FROM signature_requests sr
     JOIN cases c ON c.id = sr.case_id
     WHERE sr.id = $1 AND c.lawyer_user_id = $2`,
    [requestId, lawyerUserId]
  );
  const row = owned.rows[0];
  if (!row) throw new ApiError(404, "Signature request not found");
  if (row.status === "fully_signed") {
    throw new ApiError(409, "Cannot cancel a fully-signed request");
  }
  if (row.status === "cancelled") {
    return mapSignatureRequest(row);
  }

  const result = await pool.query(
    `UPDATE signature_requests
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [requestId]
  );
  return mapSignatureRequest(result.rows[0]);
}
