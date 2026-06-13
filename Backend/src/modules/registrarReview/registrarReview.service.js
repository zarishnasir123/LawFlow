import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import {
  getSignedCasePdfDownloadUrl,
  getCaseAttachmentSignedUrl
} from "../../services/storage.service.js";

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
    assignedTehsil: row.assigned_tehsil
  };
}

// Map one case_attachments row to the registrar's detail shape, minting a
// fresh signed view URL per attachment. Mirrors the lawyer side's
// mapCaseAttachment (cases.service.js) but trims to the four fields the
// registrar review page needs. `url` is null when minting fails — the page
// degrades to a disabled "View" link rather than erroring the whole detail.
async function mapRegistrarAttachment(row) {
  const url = row.storage_path
    ? await getCaseAttachmentSignedUrl(row.storage_path)
    : null;
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

  return {
    ...mapCaseSummary(row),
    signedPdfUrl: signed?.downloadUrl ?? null,
    signedPageIndices,
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

// R1: the registrar's queue — submitted cases in their tehsil, oldest first.
export async function listSubmittedCasesForRegistrar({ registrarUserId }) {
  const tehsil = await getRegistrarTehsil(registrarUserId);

  const result = await pool.query(
    `${selectRegistrarCase()}
     WHERE cases.status = 'submitted'
       AND LOWER(cases.assigned_tehsil) = LOWER($1)
     ORDER BY cases.submitted_at ASC`,
    [tehsil]
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
       AND LOWER(cases.assigned_tehsil) = LOWER($2)`,
    [caseId, tehsil]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "Case not found");
  }

  return mapCaseDetail(result.rows[0]);
}

// Shared write path for approve (R3) / return (R4). The UPDATE itself encodes
// every guard so the whole transition is one atomic, race-free statement:
//   - status must currently be 'submitted'
//   - the case's tehsil must match the registrar's (case-insensitive)
// rowCount === 0 means one of those failed; we surface 404 either way so a
// registrar can't probe which (existence vs. wrong-state vs. wrong-tehsil).
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
     RETURNING id`,
    [newStatus, reviewRemarks, registrarUserId, caseId, tehsil]
  );

  if (result.rowCount === 0) {
    throw new ApiError(
      404,
      "Case not found or not awaiting review in your tehsil"
    );
  }

  // Re-fetch through the shared SELECT so the returned shape matches the
  // detail endpoint exactly (signed URL + review trail included).
  return getCaseForRegistrar({ caseId, registrarUserId });
}

// R3: approve -> status='accepted'. Clears any prior return remarks since the
// case is now accepted (a stale "you forgot X" remark would be misleading).
export async function approveCaseForRegistrar({ caseId, registrarUserId }) {
  const tehsil = await getRegistrarTehsil(registrarUserId);

  return transitionCase({
    caseId,
    registrarUserId,
    tehsil,
    newStatus: "accepted",
    reviewRemarks: null
  });
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
