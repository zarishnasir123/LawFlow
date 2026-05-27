import crypto from "node:crypto";

import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import {
  queueSignatureRequestEmail,
  queueSignatureRequestCancelledEmail,
  queueSignatureCompletionEmail,
} from "../../services/email.service.js";
import { compileCaseSignedPdf } from "./signatures.compiler.js";

// Signature requests expire 14 days after creation. Long enough for the
// signer to get around to signing, short enough that stale rows don't
// hang around forever.
const DEFAULT_TTL_DAYS = 14;

// =====================================================================
// Mapping
// =====================================================================

function mapSignatureRequest(row, { includeSnapshot = false, includeImage = false } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    caseId: row.case_id,
    createdByUserId: row.created_by_user_id,
    recipientUserId: row.recipient_user_id,
    signerRole: row.signer_role,
    caseBatchId: row.case_batch_id,
    pageIndices: row.page_indices,
    signedAt: row.signed_at,
    // Position metadata captured when the signer drag-placed their
    // signature on the page. Stored as percentages of the page
    // dimensions so Phase 2 PDF compile can scale to any output size.
    signaturePlacement: row.signature_placement,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Big payloads are opt-in. List endpoints skip them; the per-row
    // signing view loads the snapshot, and only the lawyer's final
    // compile step needs the signature image bytes alongside the row.
    ...(includeSnapshot ? { documentHtmlSnapshot: row.document_html_snapshot } : {}),
    ...(includeImage ? { signatureImage: row.signature_image } : {}),
  };
}

// Lazy expiry — if the row is past its expires_at but still 'pending',
// fold that into the returned status without writing to the DB. Saves us
// a cron sweep at FYP scale.
function effectiveStatus(row) {
  if (row.status === "pending" && row.expires_at < new Date()) return "expired";
  return row.status;
}

// =====================================================================
// Ownership helpers
// =====================================================================

async function findCaseForLawyer(caseId, lawyerUserId) {
  const result = await pool.query(
    `SELECT id, lawyer_user_id, edited_html
     FROM cases
     WHERE id = $1 AND lawyer_user_id = $2`,
    [caseId, lawyerUserId]
  );
  return result.rows[0] || null;
}

// Look up a registered client user by email. Returns the user row or
// null if no account exists for that address. Email match is
// case-insensitive (we lowercase on insert in auth, but defensively
// lowercase here too).
async function findUserByEmail(email) {
  const result = await pool.query(
    `SELECT u.id, u.email, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = $1`,
    [email.trim().toLowerCase()]
  );
  return result.rows[0] || null;
}

// =====================================================================
// Lawyer-side: save edited HTML (called debounced by the editor)
// =====================================================================

export async function saveEditedDocument({ caseId, lawyerUserId, editedHtml }) {
  const existing = await findCaseForLawyer(caseId, lawyerUserId);
  if (!existing) throw new ApiError(404, "Case not found");

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

// =====================================================================
// Lawyer-side: create a batch of signature_request rows for a "Send"
// action.
//
// Input:
//   pageAssignments: [{ pageIndex: 0, signers: ['client'|'lawyer'][] }, ...]
//   clientEmail: string  — the client recipient (must already have a LawFlow account)
//
// Behaviour:
//   1. Walks the page assignments and splits them into a client page list
//      and a lawyer page list.
//   2. Emits one signature_request row per signer with non-empty pages.
//   3. All rows in the same Send share a case_batch_id so the editor can
//      group them in the UI.
//
// Returns: { batchId, requests: [...] }
// =====================================================================

export async function createSignatureRequestBatch({
  caseId,
  lawyerUserId,
  clientEmail,
  pageAssignments,
  documentHtmlSnapshot,
  ttlDays = DEFAULT_TTL_DAYS,
}) {
  const existing = await findCaseForLawyer(caseId, lawyerUserId);
  if (!existing) throw new ApiError(404, "Case not found");

  if (!Array.isArray(pageAssignments) || pageAssignments.length === 0) {
    throw new ApiError(400, "At least one page must be selected for signing");
  }

  // Resolve the client user. Phase 1 requires the client to already be
  // registered (no invite-on-the-fly); reject with a clear message
  // otherwise so the lawyer knows what to do.
  const wantsClient = pageAssignments.some((a) => a.signers?.includes("client"));
  let clientUser = null;
  if (wantsClient) {
    if (!clientEmail) {
      throw new ApiError(400, "Client email is required for client-assigned pages");
    }
    clientUser = await findUserByEmail(clientEmail);
    if (!clientUser) {
      throw new ApiError(
        400,
        "No LawFlow client account exists for that email. The client must register before you can request a signature."
      );
    }
    if (clientUser.role !== "client") {
      throw new ApiError(400, "Recipient must be a registered client.");
    }
  }

  // Split assignments per signer.
  const clientPages = [];
  const lawyerPages = [];
  for (const a of pageAssignments) {
    if (typeof a.pageIndex !== "number") continue;
    const signers = Array.isArray(a.signers) ? a.signers : [];
    if (signers.includes("client")) clientPages.push(a.pageIndex);
    if (signers.includes("lawyer")) lawyerPages.push(a.pageIndex);
  }

  if (clientPages.length === 0 && lawyerPages.length === 0) {
    throw new ApiError(400, "At least one signer must be assigned to a page");
  }

  // Snapshot source: prefer the live HTML the editor sends in the
  // payload (the most up-to-date state of what the lawyer is looking
  // at). Fall back to cases.edited_html if the frontend doesn't ship
  // one (older clients). If BOTH are missing there's literally nothing
  // to sign.
  const snapshot =
    (typeof documentHtmlSnapshot === "string" && documentHtmlSnapshot.length > 0
      ? documentHtmlSnapshot
      : null) || existing.edited_html;

  if (!snapshot) {
    throw new ApiError(
      400,
      "Document is empty. Make at least one edit in the editor, then try again."
    );
  }

  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  const batchId = crypto.randomUUID();

  const inserts = [];
  if (clientPages.length > 0 && clientUser) {
    inserts.push({
      recipient_user_id: clientUser.id,
      signer_role: "client",
      page_indices: clientPages,
    });
  }
  if (lawyerPages.length > 0) {
    inserts.push({
      // Lawyer self-signs: recipient is the same user who created the batch.
      recipient_user_id: lawyerUserId,
      signer_role: "lawyer",
      page_indices: lawyerPages,
    });
  }

  // Insert in a single transaction so we never leave the case with a
  // half-created batch. We also save the snapshot back to
  // cases.edited_html as a side effect — that way the lawyer's editor
  // and the snapshot stay in sync, and future "create signature
  // request" calls without a snapshot still find a populated case.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (documentHtmlSnapshot && documentHtmlSnapshot !== existing.edited_html) {
      await client.query(
        `UPDATE cases
         SET edited_html = $1,
             updated_at = NOW()
         WHERE id = $2 AND lawyer_user_id = $3`,
        [documentHtmlSnapshot, caseId, lawyerUserId]
      );
    }

    const created = [];
    for (const row of inserts) {
      const result = await client.query(
        `INSERT INTO signature_requests (
           case_id,
           created_by_user_id,
           recipient_user_id,
           signer_role,
           case_batch_id,
           document_html_snapshot,
           page_indices,
           expires_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          caseId,
          lawyerUserId,
          row.recipient_user_id,
          row.signer_role,
          batchId,
          snapshot,
          JSON.stringify(row.page_indices),
          expiresAt,
        ]
      );
      created.push(result.rows[0]);
    }
    await client.query("COMMIT");

    // After the transaction commits, fan out notification emails — one
    // per inserted row (so the client gets their email, the lawyer
    // gets theirs). Single JOIN query collects everything the email
    // template needs (recipient name, lawyer name, case title) so
    // we're not chasing N+1 lookups. Failures here never block the
    // HTTP response — queueEmailTask logs + swallows.
    try {
      const enrichResult = await pool.query(
        `SELECT
           sr.id,
           sr.signer_role,
           sr.expires_at,
           sr.page_indices,
           c.title AS case_title,
           recipient.email AS recipient_email,
           recipient.first_name AS recipient_first_name,
           creator.first_name AS creator_first_name,
           creator.last_name AS creator_last_name,
           creator.email AS creator_email
         FROM signature_requests sr
         JOIN cases c ON c.id = sr.case_id
         JOIN users recipient ON recipient.id = sr.recipient_user_id
         JOIN users creator ON creator.id = sr.created_by_user_id
         WHERE sr.case_batch_id = $1`,
        [batchId]
      );
      for (const row of enrichResult.rows) {
        const lawyerName =
          [row.creator_first_name, row.creator_last_name]
            .filter(Boolean)
            .join(" ")
            .trim() || row.creator_email;
        const pageCount = Array.isArray(row.page_indices)
          ? row.page_indices.length
          : 0;
        queueSignatureRequestEmail({
          email: row.recipient_email,
          firstName: row.recipient_first_name,
          caseTitle: row.case_title,
          requestingLawyerName: lawyerName,
          pageCount,
          signerRole: row.signer_role,
          expiresAt: row.expires_at,
        });
      }
    } catch (emailErr) {
      // Emails are best-effort. Log + move on.
      console.error("[SIGNATURE EMAIL DISPATCH FAILED]", {
        batchId,
        message:
          emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
    }

    return {
      batchId,
      requests: created.map((r) => mapSignatureRequest(r)),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// =====================================================================
// Lawyer-side: list signature requests for a case
// =====================================================================

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

  // Include the signature image bytes ONLY on signed rows — that's
  // the data the editor's SignatureOverlayLayer needs to render each
  // signature on the page where the signer placed it. Pending /
  // expired / cancelled rows have no image to ship, so we don't pay
  // the payload cost for them. Mapper still gates on
  // includeImage flag → the rows we mark get the field; the rest
  // serialize without it.
  return result.rows.map((row) =>
    mapSignatureRequest(
      { ...row, status: effectiveStatus(row) },
      { includeImage: row.status === "signed" }
    )
  );
}

// =====================================================================
// Recipient-side (client OR lawyer): list MY pending signature requests
// =====================================================================

export async function listPendingForRecipient({ userId }) {
  const result = await pool.query(
    `SELECT sr.*,
            c.title AS case_title,
            creator.email AS creator_email,
            creator.first_name AS creator_first_name,
            creator.last_name AS creator_last_name
     FROM signature_requests sr
     JOIN cases c ON c.id = sr.case_id
     JOIN users creator ON creator.id = sr.created_by_user_id
     WHERE sr.recipient_user_id = $1
       AND sr.status = 'pending'
       AND sr.expires_at > NOW()
     ORDER BY sr.created_at DESC`,
    [userId]
  );

  return result.rows.map((row) => ({
    ...mapSignatureRequest(row),
    caseTitle: row.case_title,
    requestingLawyerName:
      [row.creator_first_name, row.creator_last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || row.creator_email,
  }));
}

// =====================================================================
// Recipient-side: fetch one signature request with its snapshot
//
// Access control: the requesting user MUST be the recipient_user_id on
// the row. The lawyer's signature panel uses the separate lawyer-auth
// endpoint to read across all rows of a case; this one is for the
// signing UI only.
// =====================================================================

export async function getSignatureRequestForSigner({ requestId, userId }) {
  const result = await pool.query(
    `SELECT sr.*,
            c.title AS case_title
     FROM signature_requests sr
     JOIN cases c ON c.id = sr.case_id
     WHERE sr.id = $1`,
    [requestId]
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(404, "Signature request not found");

  if (row.recipient_user_id !== userId) {
    // Don't leak existence to anyone except the intended signer.
    throw new ApiError(404, "Signature request not found");
  }

  const status = effectiveStatus(row);
  if (status === "expired") throw new ApiError(410, "This signature request has expired");
  if (status === "cancelled") throw new ApiError(410, "This signature request was cancelled");

  return {
    ...mapSignatureRequest(row, { includeSnapshot: true }),
    caseTitle: row.case_title,
  };
}

// =====================================================================
// Recipient-side: submit signature
//
// The unified column model means the same handler handles client and
// lawyer signers — recipient_user_id matching is the auth check.
// =====================================================================

export async function submitSignature({
  requestId,
  userId,
  signatureImage,
  signaturePlacement,
}) {
  if (!signatureImage || typeof signatureImage !== "string") {
    throw new ApiError(400, "Signature image is required");
  }
  if (!signatureImage.startsWith("data:image/")) {
    throw new ApiError(400, "Signature must be a base64 image data URL");
  }

  const existing = await pool.query(
    `SELECT * FROM signature_requests WHERE id = $1`,
    [requestId]
  );
  const row = existing.rows[0];
  if (!row) throw new ApiError(404, "Signature request not found");

  if (row.recipient_user_id !== userId) {
    throw new ApiError(404, "Signature request not found");
  }
  if (row.status === "cancelled" || row.expires_at < new Date()) {
    throw new ApiError(410, "This signature request is no longer active");
  }
  if (row.signed_at) {
    throw new ApiError(409, "This signature request has already been signed");
  }

  // signature_placement is JSONB; stringify so node-postgres serializes
  // it correctly. Null is fine — Phase 2 compile falls back to a default
  // bottom-right slot if no placement is captured.
  const placementJson =
    signaturePlacement && typeof signaturePlacement === "object"
      ? JSON.stringify(signaturePlacement)
      : null;

  const updated = await pool.query(
    `UPDATE signature_requests
     SET signature_image = $1,
         signature_placement = $2,
         signed_at = NOW(),
         status = 'signed',
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [signatureImage, placementJson, requestId]
  );

  const updatedRow = updated.rows[0];

  // Notify the case's owning lawyer that a signer just completed.
  // Skip the email when the lawyer signed their own request (would
  // otherwise be sending themselves "you signed this"). The lookup
  // is async + fire-and-forget — never block the signer's HTTP
  // response on an email send.
  if (updatedRow.created_by_user_id !== updatedRow.recipient_user_id) {
    setImmediate(() => {
      pool
        .query(
          `SELECT
             lawyer.email          AS lawyer_email,
             lawyer.first_name     AS lawyer_first_name,
             signer.first_name     AS signer_first_name,
             signer.last_name      AS signer_last_name,
             signer.email          AS signer_email,
             c.title               AS case_title
           FROM signature_requests sr
           JOIN cases c          ON c.id      = sr.case_id
           JOIN users lawyer     ON lawyer.id = sr.created_by_user_id
           JOIN users signer     ON signer.id = sr.recipient_user_id
           WHERE sr.id = $1`,
          [updatedRow.id]
        )
        .then(({ rows }) => {
          const r = rows[0];
          if (!r || !r.lawyer_email) return;
          const signerName =
            [r.signer_first_name, r.signer_last_name]
              .filter(Boolean)
              .join(" ")
              .trim() || r.signer_email;
          return queueSignatureCompletionEmail({
            lawyerEmail: r.lawyer_email,
            lawyerFirstName: r.lawyer_first_name,
            signerName,
            signerRole: updatedRow.signer_role,
            caseId: updatedRow.case_id,
            caseTitle: r.case_title,
            pageIndices: updatedRow.page_indices,
          });
        })
        .catch((err) => {
          console.error("[COMPLETION EMAIL FAILED]", {
            caseId: updatedRow.case_id,
            requestId: updatedRow.id,
            message: err instanceof Error ? err.message : String(err),
          });
        });
    });
  }

  // If this submission tips the case over the line — every required
  // signature now collected — fire the PDF compile in the BACKGROUND.
  // Compile is puppeteer + pdf-lib + Supabase upload, which takes
  // 2-4 seconds. We don't make the signer wait, and crucially we
  // don't tie up the backend's event loop while the lawyer's editor
  // is fetching the case in parallel — that race was the cause of
  // the "Untitled document / No document loaded" state in the editor
  // after sign-off. The 15s poll on the lawyer's editor picks up
  // signed_pdf_storage_path once compile finishes.
  //
  // setImmediate is the same pattern email sends use (see
  // queueEmailTask in email.service.js) — defers to the next
  // event-loop tick so the HTTP response can flush first.
  setImmediate(() => {
    isCaseFullySigned({
      caseId: updatedRow.case_id,
      lawyerUserId: updatedRow.created_by_user_id,
    })
      .then((completion) => {
        if (!completion.fullySigned) return null;
        return compileCaseSignedPdf({
          caseId: updatedRow.case_id,
          lawyerUserId: updatedRow.created_by_user_id,
        });
      })
      .catch((err) => {
        // Best-effort: the row is already saved as 'signed'. Lawyer
        // can re-trigger via a future /recompile endpoint.
        console.error("[COMPILE FAILED]", {
          caseId: updatedRow.case_id,
          requestId: updatedRow.id,
          message: err instanceof Error ? err.message : String(err),
        });
      });
  });

  return mapSignatureRequest(updatedRow);
}

// =====================================================================
// Lawyer-side: cancel a request before signing
// =====================================================================

export async function cancelSignatureRequest({ requestId, lawyerUserId }) {
  // Single round-trip ownership + email-context lookup. JOINing the
  // recipient + canceller rows here means we don't need a second
  // SELECT after the UPDATE just to build the notification payload.
  const owned = await pool.query(
    `SELECT
       sr.id,
       sr.status,
       sr.recipient_user_id,
       sr.signer_role,
       sr.page_indices,
       c.title AS case_title,
       recipient.email      AS recipient_email,
       recipient.first_name AS recipient_first_name,
       canceller.first_name AS canceller_first_name,
       canceller.last_name  AS canceller_last_name,
       canceller.email      AS canceller_email
     FROM signature_requests sr
     JOIN cases c ON c.id = sr.case_id
     JOIN users recipient ON recipient.id = sr.recipient_user_id
     JOIN users canceller ON canceller.id = $2
     WHERE sr.id = $1 AND c.lawyer_user_id = $2`,
    [requestId, lawyerUserId]
  );
  const row = owned.rows[0];
  if (!row) throw new ApiError(404, "Signature request not found");
  if (row.status === "signed") {
    throw new ApiError(409, "Cannot cancel a signed request");
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

  // Fire the withdrawal notification AFTER the UPDATE commits. We
  // skip the self-cancel case (lawyer cancelling a row whose
  // recipient is themselves — the "Both" signer flow creates one
  // row per signer, so the lawyer's own row gets cancelled too).
  // Same setImmediate + try/catch shape used by submitSignature
  // for the completion email; per AGENTS.md, email sends never
  // block the request that triggered them.
  const isSelfCancel = row.recipient_user_id === lawyerUserId;
  if (!isSelfCancel) {
    const pageCount = Array.isArray(row.page_indices) ? row.page_indices.length : 0;
    const cancellerName =
      [row.canceller_first_name, row.canceller_last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || row.canceller_email;

    setImmediate(() => {
      try {
        queueSignatureRequestCancelledEmail({
          email: row.recipient_email,
          firstName: row.recipient_first_name,
          caseTitle: row.case_title,
          requestingLawyerName: cancellerName,
          pageCount,
          signerRole: row.signer_role,
        });
      } catch (err) {
        // queueEmailTask already swallows + logs downstream failures,
        // but the wrapping try/catch defends against a synchronous
        // throw if the helper itself blows up. We never want a
        // notification failure to surface as a cancel failure.
        console.error("[signature-cancelled email] queue failed:", err?.message);
      }
    });
  }

  return mapSignatureRequest(result.rows[0]);
}

// =====================================================================
// Lawyer-side: derive "is the case fully signed?" for the editor UI
//
// Returns true when there's at least one signature_request on the case
// AND every one of them has status='signed'. Used to decide whether to
// show the "Download signed PDF" / "Submit case" CTAs.
// =====================================================================

// =====================================================================
// Lawyer-side: get a short-lived signed URL for the compiled PDF.
// =====================================================================
//
// Returns { downloadUrl, expiresInSeconds } when the case has a
// compiled PDF in storage, or throws 409 if signing isn't complete yet.
// The storage path itself is NEVER returned to the client — the URL
// expires (default 5 min) so a leaked link has minimal blast radius.
export async function getSignedCasePdfDownload({ caseId, lawyerUserId }) {
  const existing = await findCaseForLawyer(caseId, lawyerUserId);
  if (!existing) throw new ApiError(404, "Case not found");

  const result = await pool.query(
    `SELECT signed_pdf_storage_path, signed_pdf_generated_at
     FROM cases
     WHERE id = $1`,
    [caseId]
  );
  const row = result.rows[0];
  if (!row || !row.signed_pdf_storage_path) {
    throw new ApiError(409, "Signed PDF is not ready yet");
  }

  // Lazy import — keeps the cycle clean (storage.service imports
  // supabase which imports nothing from here).
  const { getSignedCasePdfDownloadUrl } = await import(
    "../../services/storage.service.js"
  );
  const signed = await getSignedCasePdfDownloadUrl({
    storagePath: row.signed_pdf_storage_path,
    expiresInSeconds: 300,
  });
  if (!signed) {
    throw new ApiError(
      503,
      "Storage is not configured to mint signed URLs"
    );
  }

  return {
    downloadUrl: signed.downloadUrl,
    expiresInSeconds: signed.expiresInSeconds,
    generatedAt: row.signed_pdf_generated_at,
  };
}

export async function isCaseFullySigned({ caseId, lawyerUserId }) {
  const ownership = await findCaseForLawyer(caseId, lawyerUserId);
  if (!ownership) throw new ApiError(404, "Case not found");

  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'signed')                          AS signed_count,
       COUNT(*) FILTER (WHERE status IN ('pending', 'expired'))           AS open_count,
       COUNT(*) AS total
     FROM signature_requests
     WHERE case_id = $1
       AND status != 'cancelled'`,
    [caseId]
  );
  const { signed_count, open_count, total } = result.rows[0];
  return {
    total: Number(total),
    signedCount: Number(signed_count),
    openCount: Number(open_count),
    fullySigned: Number(total) > 0 && Number(open_count) === 0,
  };
}
