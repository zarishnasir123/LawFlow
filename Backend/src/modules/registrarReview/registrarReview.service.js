import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import {
  getSignedCasePdfDownloadUrl,
  getCaseAttachmentSignedUrl
} from "../../services/storage.service.js";
import { createNotification } from "../notifications/notifications.service.js";
import { queueNotificationEmail } from "../../services/email.service.js";
import { safeRecordCaseEvent } from "../cases/caseEvents.service.js";
import { proposeFirstHearing } from "../hearings/hearings.service.js";

// =====================================================================
// Registrar-facing case review.
//
// The logged-in registrar only ever sees / acts on cases routed to THEIR
// tehsil. The tehsil comes from registrar_profiles.assigned_tehsil for the
// registrar's user account, and matching is case-insensitive (LOWER(a) =
// LOWER(b)) so "Saddar" and "saddar" route to the same registrar.
//
// All SQL is parameterised. The tehsil ownership check is enforced in SQL on
// every read/write so a registrar can never read or action a case outside
// their jurisdiction — even by guessing a caseId from another tehsil.
// =====================================================================

// Shared SELECT for the registrar queue + detail. Joins:
//   case_types  -> type label (display_name) + category
//   users (lawyer) -> the owning lawyer's display name
// The client display name comes from cases.client_name (free-form text the
// lawyer captured at creation; a case need not have a registered client user).
function selectRegistrarCase() {
  return `SELECT
    cases.id,
    cases.title,
    case_types.display_name        AS case_type_label,
    case_types.category            AS category,
    cases.client_name              AS client_name,
    lawyer.first_name              AS lawyer_first_name,
    lawyer.last_name               AS lawyer_last_name,
    cases.status,
    cases.submitted_at,
    cases.assigned_tehsil,
    cases.signed_pdf_storage_path,
    cases.edited_html,
    cases.review_remarks,
    cases.reviewed_at
  FROM cases
  JOIN case_types ON case_types.id = cases.case_type_id
  JOIN users AS lawyer ON lawyer.id = cases.lawyer_user_id`;
}

function buildLawyerName(row) {
  return [row.lawyer_first_name, row.lawyer_last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || null;
}

// CaseSummary: the queue row shape. camelCase out, mapped from DB columns.
function mapCaseSummary(row) {
  return {
    id: row.id,
    title: row.title,
    caseTypeLabel: row.case_type_label,
    category: row.category,
    clientName: row.client_name,
    lawyerName: buildLawyerName(row),
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    assignedTehsil: row.assigned_tehsil
  };
}

// Map one case_attachments row to the registrar's detail shape, minting a
// fresh signed view URL per attachment. Mirrors the lawyer side's
// mapCaseAttachment (cases.service.js) but trims to the four fields the
// registrar review page needs. `url` is null when minting fails — the page
// degrades to a Retry prompt rather than erroring the whole detail.
//
// The mint is wrapped so a genuinely THROWN storage error (e.g. the storage
// service is asleep and supabase-js surfaces a "fetch failed" instead of the
// usual {error} result) degrades this one attachment to url:null instead of
// rejecting the Promise.all and 500-ing the entire case detail. The detail
// itself comes from Postgres and must always render so the registrar can still
// read and action the case; only the storage-backed URLs are best-effort.
async function mapRegistrarAttachment(row) {
  let url = null;
  if (row.storage_path) {
    try {
      url = await getCaseAttachmentSignedUrl(row.storage_path);
    } catch (err) {
      console.warn(
        `[registrar] failed to mint signed URL for attachment ${row.id}:`,
        err?.message ?? err
      );
      url = null;
    }
  }
  return {
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    url
  };
}

// Load every attachment for a case (oldest first), each with a signed URL.
// Same column set + ordering the lawyer's listCaseAttachments uses. Called
// only from the detail path, after the tehsil ownership check has passed.
async function loadCaseAttachments(caseId) {
  const result = await pool.query(
    `SELECT id, file_name, mime_type, storage_path
     FROM case_attachments
     WHERE case_id = $1
     ORDER BY created_at ASC`,
    [caseId]
  );

  return Promise.all(result.rows.map(mapRegistrarAttachment));
}

// The sorted, de-duplicated list of 0-based absolute page indices that carry
// a completed signature for this case. Mirrors the lawyer client's overlay
// logic: each signed signature_requests row owns a slice of page_indices
// (JSONB array of 0-based indices), so we union them across all signed rows.
//
// page_indices parsing reuses the pattern from signatures.service.js
// (getSignatureRequestForSigner): node-postgres auto-parses JSONB to a JS
// array, but a JSON string is handled too. A NULL page_indices means "entire
// document" — the lawyer client treats a null page list as empty, so we
// contribute nothing for those rows. Returns [] when no signed pages exist.
//
// Detail-only: called from mapCaseDetail, inside the tehsil-ownership-checked
// getCaseForRegistrar path. Parameterised SQL.
async function loadSignedPageIndices(caseId) {
  const result = await pool.query(
    `SELECT page_indices
     FROM signature_requests
     WHERE case_id = $1
       AND status = 'signed'`,
    [caseId]
  );

  const indices = new Set();
  for (const row of result.rows) {
    let pages = row.page_indices;
    if (typeof pages === "string") {
      // node-postgres usually auto-parses JSONB; this string branch is a
      // rarely-hit fallback. Guard it so a malformed value skips the row
      // instead of 500-ing the whole detail response.
      try {
        pages = JSON.parse(pages);
      } catch {
        continue;
      }
    }
    if (!Array.isArray(pages)) continue;
    for (const pageIndex of pages) {
      if (typeof pageIndex === "number") indices.add(pageIndex);
    }
  }

  return [...indices].sort((a, b) => a - b);
}

// Per-page signer breakdown for the review sidebar: which signer(s) have SIGNED
// each page (client, lawyer, or both). Unlike loadSignedPageIndices (which
// collapses the signer away into a flat page list), this keeps signer_role so
// the UI can show the same "Client + Lawyer Signed" / "Client Signed" /
// "Lawyer Signed" badges as the editor. Exposes only the role — never a name or
// any PII. Detail-only: called from mapCaseDetail inside the tehsil-checked
// getCaseForRegistrar path. Parameterised SQL.
async function loadSignedPageRoles(caseId) {
  const result = await pool.query(
    `SELECT signer_role, page_indices
     FROM signature_requests
     WHERE case_id = $1
       AND status = 'signed'`,
    [caseId]
  );

  const byPage = new Map();
  for (const row of result.rows) {
    let pages = row.page_indices;
    if (typeof pages === "string") {
      try {
        pages = JSON.parse(pages);
      } catch {
        continue;
      }
    }
    if (!Array.isArray(pages)) continue;
    const isClient = row.signer_role === "client";
    for (const pageIndex of pages) {
      if (typeof pageIndex !== "number") continue;
      const cur =
        byPage.get(pageIndex) ?? { clientSigned: false, lawyerSigned: false };
      if (isClient) cur.clientSigned = true;
      else cur.lawyerSigned = true;
      byPage.set(pageIndex, cur);
    }
  }

  return [...byPage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pageIndex, s]) => ({
      pageIndex,
      clientSigned: s.clientSigned,
      lawyerSigned: s.lawyerSigned
    }));
}

// CaseDetail = CaseSummary + the review trail + a short-lived signed URL for
// the signed PDF (null when no PDF has been compiled yet) + the COMPLETE case
// file: the prepared-document HTML snapshot (cases.edited_html) and every
// attachment with a freshly-minted signed view URL. Async because the signed
// URLs are minted on demand via the storage service.
//
// Detail-only: the queue/list (R1) keeps the mapCaseSummary shape unchanged.
async function mapCaseDetail(row) {
  const signed = row.signed_pdf_storage_path
    ? await getSignedCasePdfDownloadUrl({ storagePath: row.signed_pdf_storage_path })
    : null;

  const attachments = await loadCaseAttachments(row.id);
  const signedPageIndices = await loadSignedPageIndices(row.id);
  const pageSignatures = await loadSignedPageRoles(row.id);

  return {
    ...mapCaseSummary(row),
    signedPdfUrl: signed?.downloadUrl ?? null,
    signedPageIndices,
    pageSignatures,
    editedHtml: row.edited_html ?? null,
    attachments,
    reviewRemarks: row.review_remarks,
    reviewedAt: row.reviewed_at
  };
}

// Resolve the registrar's assigned tehsil from their user id. Throws 403 when
// the registrar has no profile / no tehsil assigned — they cannot own a queue
// until an admin gives them a jurisdiction, and we must never fall back to
// "match everything".
async function getRegistrarTehsil(registrarUserId) {
  const result = await pool.query(
    `SELECT assigned_tehsil
     FROM registrar_profiles
     WHERE user_id = $1`,
    [registrarUserId]
  );

  const tehsil = result.rows[0]?.assigned_tehsil;

  if (!tehsil || !tehsil.trim()) {
    throw new ApiError(
      403,
      "No tehsil is assigned to your registrar account. Contact an administrator."
    );
  }

  return tehsil;
}

// The status values a registrar may list, mapped to the column + direction
// each list is sorted by. The submitted queue is oldest-first (FIFO, so the
// registrar works the backlog from the top); the accepted / returned lists are
// most-recent-decision-first (reviewed_at DESC) so the latest decisions surface
// at the top of the persistent lists / dashboard. The ORDER BY is built from
// this allow-list ONLY (never from user input), so the status param can never
// reach the SQL string — the tehsil + the chosen status both bind as $-params.
const LISTABLE_STATUS_ORDER = {
  submitted: "cases.submitted_at ASC",
  accepted: "cases.reviewed_at DESC",
  returned: "cases.reviewed_at DESC"
};

// R1: the registrar's cases in their tehsil, filtered by `status`
// (default 'submitted' — the original queue). Ordering per status:
//   submitted -> submitted_at ASC  (queue, oldest first)
//   accepted  -> reviewed_at DESC  (most recent decision first)
//   returned  -> reviewed_at DESC  (most recent decision first)
// Status is validated at the route boundary; we re-clamp to the allow-list here
// so an unexpected value can never select an arbitrary ORDER BY fragment.
export async function listSubmittedCasesForRegistrar({
  registrarUserId,
  status = "submitted"
}) {
  const tehsil = await getRegistrarTehsil(registrarUserId);

  const orderBy = LISTABLE_STATUS_ORDER[status];
  if (!orderBy) {
    // Defensive: the validator already rejects anything else with a 400, so
    // this only fires if a caller bypasses it. Surface a 400 rather than a 500.
    throw new ApiError(400, "Unsupported case status filter");
  }

  const result = await pool.query(
    `${selectRegistrarCase()}
     WHERE cases.status = $1
       AND LOWER(cases.assigned_tehsil) = LOWER($2)
     ORDER BY ${orderBy}`,
    [status, tehsil]
  );

  return result.rows.map(mapCaseSummary);
}

// R2: one case detail. 404 on not-found OR tehsil mismatch — we don't leak
// the existence of a case in another registrar's jurisdiction.
export async function getCaseForRegistrar({ caseId, registrarUserId }) {
  const tehsil = await getRegistrarTehsil(registrarUserId);

  const result = await pool.query(
    `${selectRegistrarCase()}
     WHERE cases.id = $1
       AND LOWER(cases.assigned_tehsil) = LOWER($2)
       AND cases.status IN ('submitted', 'accepted', 'returned')`,
    [caseId, tehsil]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "Case not found");
  }

  return mapCaseDetail(result.rows[0]);
}

// Build the notification payload for a completed transition.
// Returns null for any status we don't notify on (defensive — only the two
// real transitions produce a notification). The message embeds the case
// title; the return variant appends the registrar's remarks so the lawyer
// sees why it bounced. No PII (lawyer/client names) goes into the text.
function buildNotificationPayload({ status, caseId, title, userId, reviewRemarks }) {
  const safeTitle = title ?? "your case";

  if (status === "accepted") {
    return {
      userId,
      type: "case_accepted",
      title: "Case accepted",
      message: `Your case "${safeTitle}" was accepted by the registrar and can proceed.`,
      caseId
    };
  }

  if (status === "returned") {
    const reason = reviewRemarks?.trim() || "No reason provided.";
    return {
      userId,
      type: "case_returned",
      title: "Case returned for corrections",
      message: `Your case "${safeTitle}" was returned by the registrar. Reason: ${reason}`,
      caseId
    };
  }

  return null;
}

// Fire-and-forget notification for the case participants after a transition.
// BEST-EFFORT: a failure here must never break or roll back the approve /
// return response, so we swallow any error and log a non-PII line. The
// notification INSERT is intentionally outside the transition's success
// path's return value — the registrar's action has already committed.
async function notifyUsersOfTransition({ status, caseId, title, lawyerUserId, clientUserId, reviewRemarks }) {
  const userIds = [lawyerUserId, clientUserId].filter(Boolean);

  for (const userId of userIds) {
    const payload = buildNotificationPayload({
      status,
      caseId,
      title,
      userId,
      reviewRemarks
    });
    if (!payload) continue;

    try {
      await createNotification(payload);
    } catch (error) {
      // Log enough to debug, but never the case title / user identity (PII).
      console.error(
        `Failed to create ${status} notification for user ${userId} on case ${caseId}:`,
        error?.message ?? error
      );
    }
  }

  // Best-effort EMAIL to BOTH the client and the lawyer for case accepted /
  // returned (each gated by their own "case" preference; the in-app bell above
  // is never gated). Never throws into the approve/return response.
  if (status === "accepted" || status === "returned") {
    const accepted = status === "accepted";
    const reason = reviewRemarks?.trim();
    const safeTitle = title ?? "your case";

    for (const recipientId of [clientUserId, lawyerUserId].filter(Boolean)) {
      try {
        const contact = await pool.query(
          "SELECT email, first_name FROM users WHERE id = $1",
          [recipientId]
        );
        const recipient = contact.rows[0];
        if (!recipient?.email) continue;
        queueNotificationEmail({
          email: recipient.email,
          firstName: recipient.first_name,
          userId: recipientId,
          category: "case",
          subject: accepted
            ? `Case accepted — ${safeTitle}`
            : `Case returned — ${safeTitle}`,
          heading: accepted ? "Case Accepted" : "Case Returned for Corrections",
          intro: accepted
            ? `Your case "${safeTitle}" was accepted by the registrar and can now proceed.`
            : `Your case "${safeTitle}" was returned by the registrar and needs corrections before it can proceed.`,
          caseTitle: safeTitle,
          detailLabel: "Status",
          detailValue: accepted ? "Accepted" : "Returned for corrections",
          showRemarks: !accepted && Boolean(reason),
          remarksLabel: "Registrar's remarks",
          remarks: reason || "",
          footerNote: accepted
            ? "Open LawFlow to continue with the next steps."
            : "Open LawFlow to review the remarks and resubmit.",
        });
      } catch (error) {
        console.error(
          `Failed to queue case ${status} email for case ${caseId}:`,
          error?.message ?? error
        );
      }
    }
  }
}

// Shared write path for approve (R3) / return (R4). The UPDATE itself encodes
// every guard so the whole transition is one atomic, race-free statement:
//   - status must currently be 'submitted'
//   - the case's tehsil must match the registrar's (case-insensitive)
// rowCount === 0 means one of those failed; we surface 404 either way so a
// registrar can't probe which (existence vs. wrong-state vs. wrong-tehsil).
//
// RETURNING also carries lawyer_user_id + title so we can fire the lawyer's
// in-app notification without a second SELECT.
async function transitionCase({
  caseId,
  registrarUserId,
  tehsil,
  newStatus,
  reviewRemarks
}) {
  const result = await pool.query(
    `UPDATE cases
     SET status = $1,
         review_remarks = $2,
         reviewed_at = NOW(),
         reviewed_by_registrar_id = $3,
         updated_at = NOW()
     WHERE id = $4
       AND status = 'submitted'
       AND LOWER(assigned_tehsil) = LOWER($5)
     RETURNING id, lawyer_user_id, client_user_id, title`,
    [newStatus, reviewRemarks, registrarUserId, caseId, tehsil]
  );

  if (result.rowCount === 0) {
    throw new ApiError(
      404,
      "Case not found or not awaiting review in your tehsil"
    );
  }

  const updatedRow = result.rows[0];

  // Re-fetch through the shared SELECT so the returned shape matches the
  // detail endpoint exactly (signed URL + review trail included).
  const detail = await getCaseForRegistrar({ caseId, registrarUserId });

  // Best-effort participants notification. Awaited (so the helper's own try/catch
  // runs) but it can never throw out here — a notification failure leaves the
  // approve/return response untouched.
  await notifyUsersOfTransition({
    status: newStatus,
    caseId,
    title: updatedRow.title,
    lawyerUserId: updatedRow.lawyer_user_id,
    clientUserId: updatedRow.client_user_id,
    reviewRemarks
  });

  // Best-effort audit event AFTER the transition has committed (and after the
  // lawyer notification). newStatus is 'returned' or 'accepted'; the registrar
  // is the actor. reviewRemarks is only meaningful on a return, so attach it
  // only there. Never throws out here — same convention as the notification.
  await safeRecordCaseEvent({
    caseId,
    eventType: newStatus,
    actorUserId: registrarUserId,
    actorRole: "registrar",
    payload: {
      fromStatus: "submitted",
      toStatus: newStatus,
      tehsil,
      ...(newStatus === "returned" ? { reviewRemarks } : {})
    }
  });

  return detail;
}

// R3: approve -> status='accepted'. Clears any prior return remarks since the
// case is now accepted (a stale "you forgot X" remark would be misleading).
export async function approveCaseForRegistrar({ caseId, registrarUserId }) {
  const tehsil = await getRegistrarTehsil(registrarUserId);

  const detail = await transitionCase({
    caseId,
    registrarUserId,
    tehsil,
    newStatus: "accepted",
    reviewRemarks: null
  });

  // After the case is accepted, propose Hearing #1
  setImmediate(async () => {
    try {
      await proposeFirstHearing({ caseId, registrarUserId });
    } catch (err) {
      console.error(`Failed to auto-propose hearing for case ${caseId}:`, err?.message);
    }
  });

  return detail;
}

// R4: return -> status='returned' with the registrar's remarks recorded so the
// lawyer sees why it bounced and can fix + resubmit.
export async function returnCaseForRegistrar({ caseId, registrarUserId, remarks }) {
  const tehsil = await getRegistrarTehsil(registrarUserId);

  return transitionCase({
    caseId,
    registrarUserId,
    tehsil,
    newStatus: "returned",
    reviewRemarks: remarks
  });
}
