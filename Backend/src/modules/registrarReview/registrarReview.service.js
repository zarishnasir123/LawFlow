import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import { getSignedCasePdfDownloadUrl } from "../../services/storage.service.js";

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

// CaseDetail = CaseSummary + the review trail + a short-lived signed URL for
// the signed PDF (null when no PDF has been compiled yet). Async because the
// signed URL is minted on demand via the storage service.
async function mapCaseDetail(row) {
  const signed = row.signed_pdf_storage_path
    ? await getSignedCasePdfDownloadUrl({ storagePath: row.signed_pdf_storage_path })
    : null;

  return {
    ...mapCaseSummary(row),
    signedPdfUrl: signed?.downloadUrl ?? null,
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
