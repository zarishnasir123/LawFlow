import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import { isSupportedTehsil } from "../../utils/location.js";
import { safeRecordCaseEvent } from "./caseEvents.service.js";
import { createNotification } from "../notifications/notifications.service.js";
import { queueNotificationEmail } from "../../services/email.service.js";
import {
  deleteCaseAttachment as deleteCaseAttachmentObject,
  deleteSignedCasePdf,
  getCaseAttachmentSignedUrl,
  uploadCaseAttachment as uploadCaseAttachmentObject,
} from "../../services/storage.service.js";

// Absolute path to the case-templates root. Computed once at module load so
// the path traversal check below is anchored to a single trusted directory.
const here = path.dirname(fileURLToPath(import.meta.url));
const CASE_TEMPLATES_DIR = path.resolve(here, "..", "..", "services", "case-templates");

function mapCaseType(row) {
  return {
    id: row.id,
    category: row.category,
    code: row.code,
    displayName: row.display_name,
    governingLaw: row.governing_law,
    sortOrder: row.sort_order
  };
}

function mapCase(row) {
  return {
    id: row.id,
    lawyerUserId: row.lawyer_user_id,
    caseTypeId: row.case_type_id,
    caseTypeCode: row.case_type_code,
    caseTypeName: row.case_type_display_name,
    caseCategory: row.case_type_category,
    governingLaw: row.case_type_governing_law,
    title: row.title,
    description: row.description,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    oppositePartyName: row.opposite_party_name,
    // Lawyer's saved HTML edit state. NULL until the lawyer touches the
    // template; on the frontend, null means "render the fresh template
    // bytes", non-null means "rehydrate this HTML directly into the
    // docx-preview host".
    editedHtml: row.edited_html,
    // Signed-PDF artifact: populated by the background compile in
    // signatures.service.js once every signature_request on the case
    // reaches status='signed'. The frontend uses this to:
    //   1. Decide whether to surface "Download signed PDF" in the editor
    //   2. Preview the signed PDF on the submit-to-registrar page
    // The path is internal-only; downloads always go through a 5-min
    // signed URL minted on demand.
    signedPdfStoragePath: row.signed_pdf_storage_path,
    signedPdfGeneratedAt: row.signed_pdf_generated_at,
    // Jurisdiction the case is routed to + the registrar review trail.
    assignedTehsil: row.assigned_tehsil,
    reviewRemarks: row.review_remarks,
    reviewedAt: row.reviewed_at,
    reviewedByRegistrarId: row.reviewed_by_registrar_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at
  };
}

// The lawyer's case-type picker. Only returns types a lawyer can actually
// draft on — i.e. types that HAVE a template available, either an admin
// upload (case_type_templates row) or a built-in .docx on disk (the original
// 10). An admin-added type with no template yet is hidden so a half-finished
// type never appears broken; it shows up the moment a template is uploaded.
export async function listCaseTypes() {
  const result = await pool.query(
    `SELECT ct.id, ct.category, ct.code, ct.display_name, ct.governing_law,
            ct.sort_order,
            (ctt.id IS NOT NULL) AS has_custom_template
     FROM case_types ct
     LEFT JOIN case_type_templates ctt ON ctt.case_type_id = ct.id
     ORDER BY ct.category, ct.sort_order, ct.display_name`
  );

  const available = [];
  for (const row of result.rows) {
    const hasTemplate =
      row.has_custom_template === true ||
      (await findDiskTemplatePath(row.category, row.code)) !== null;
    if (hasTemplate) {
      available.push(mapCaseType(row));
    }
  }

  return available;
}

async function findCaseTypeById(caseTypeId) {
  const result = await pool.query(
    "SELECT id FROM case_types WHERE id = $1",
    [caseTypeId]
  );

  return result.rows[0] || null;
}

// Resolve which registered CLIENT account (if any) this case should be linked
// to, so the client can later see it on their read-only "My Cases" view.
//
// Resolution order (per the client-linking contract):
//   1. If the caller already supplied a clientUserId, trust it — but only after
//      confirming the id belongs to a user whose role is 'client'. This stops a
//      lawyer from accidentally (or maliciously) linking a case to a lawyer /
//      registrar / admin account.
//   2. Otherwise, look the client up by email: a registered user with role
//      'client' whose email matches case-insensitively. users.email is CITEXT
//      so equality is already case-insensitive, but we LOWER() both sides
//      explicitly to keep the intent obvious and robust to a column-type change.
//   3. If neither yields a match, return null. The case still captures the
//      client by free-text name/email/phone — it simply isn't linked to a
//      LawFlow account.
//
// Never throws: an unresolved client is a normal, supported outcome, not an
// error. Parameterised SQL throughout.
async function resolveClientUserId({ clientUserId, clientEmail }) {
  if (clientUserId) {
    const byId = await pool.query(
      `SELECT users.id
       FROM users
       JOIN roles ON roles.id = users.role_id
       WHERE users.id = $1 AND roles.name = 'client'
       LIMIT 1`,
      [clientUserId]
    );

    if (byId.rowCount > 0) {
      return byId.rows[0].id;
    }
    // Provided id was not a valid client — fall through and try the email so a
    // bad/foreign id doesn't silently block an otherwise-resolvable link.
  }

  if (clientEmail) {
    const byEmail = await pool.query(
      `SELECT users.id
       FROM users
       JOIN roles ON roles.id = users.role_id
       WHERE LOWER(users.email::text) = LOWER($1) AND roles.name = 'client'
       LIMIT 1`,
      [clientEmail]
    );

    if (byEmail.rowCount > 0) {
      return byEmail.rows[0].id;
    }
  }

  return null;
}

// Resolve a case-template .docx for a given case_types.code.
//
// Security model:
//   1. The DB row is the source of truth for both `category` and `code` — the
//      caller's input is only used to look up the row, never to build the path.
//      This means a request like `?code=../../etc/passwd` cannot escape the
//      template directory: it would simply fail the SELECT.
//   2. After computing the path, we re-resolve and check it still sits under
//      CASE_TEMPLATES_DIR (belt-and-braces defence against any future change
//      that lets user input near path.join).
//   3. Filename naming matches `case_types.code` exactly (kebab_case). The
//      generator writes files using these same identifiers; the lookup is a
//      simple string equality, no escape needed.
export async function resolveCaseTemplate(code) {
  const result = await pool.query(
    `SELECT ct.code, ct.category, ct.display_name,
            ctt.storage_path AS template_storage_path,
            ctt.file_name    AS template_file_name
     FROM case_types ct
     LEFT JOIN case_type_templates ctt ON ctt.case_type_id = ct.id
     WHERE ct.code = $1`,
    [code]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "Case type not found");
  }

  const row = result.rows[0];

  // Prefer the admin-uploaded template when one exists for this type. The
  // bytes live in Supabase; the controller downloads + streams them. The
  // storage path is DB-controlled (built by the admin upload service), never
  // user input, so there's no traversal surface here.
  if (row.template_storage_path) {
    return {
      source: "supabase",
      storagePath: row.template_storage_path,
      fileName: row.template_file_name || `${row.code}.docx`,
      displayName: row.display_name,
      category: row.category
    };
  }

  // Fall back to the built-in on-disk template (the original 10). The shared
  // findDiskTemplatePath helper applies the path-traversal guard + existence
  // check. If it's missing, the .docx hasn't been generated on this host —
  // run `npm run generate:case-templates` once and the file will appear.
  const filePath = await findDiskTemplatePath(row.category, row.code);
  if (!filePath) {
    throw new ApiError(404, "Template file is not available on the server");
  }

  return {
    source: "disk",
    filePath,
    fileName: `${row.code}.docx`,
    displayName: row.display_name,
    category: row.category
  };
}

// Non-throwing disk-template lookup. Returns the absolute path to the built-in
// .docx for this category+code when it exists on disk, else null. Shares the
// CASE_TEMPLATES_DIR root + path-traversal guard with resolveCaseTemplate so
// the on-disk template convention has a single owner. Used by the admin
// case-type service (to compute template status / serve the built-in default
// for preview) and, in Chunk 3, by resolveCaseTemplate's fallback path.
export async function findDiskTemplatePath(category, code) {
  if (!category || !code) return null;

  const filePath = path.resolve(CASE_TEMPLATES_DIR, category, `${code}.docx`);
  if (!filePath.startsWith(CASE_TEMPLATES_DIR + path.sep)) {
    return null;
  }

  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

// Build the SELECT used by every "fetch a case" path so the joined case_type
// columns stay in sync between list / get / create / update responses.
function selectCaseWithType() {
  return `SELECT
    cases.id,
    cases.lawyer_user_id,
    cases.case_type_id,
    case_types.code           AS case_type_code,
    case_types.display_name   AS case_type_display_name,
    case_types.category       AS case_type_category,
    case_types.governing_law  AS case_type_governing_law,
    cases.title,
    cases.description,
    cases.client_name,
    cases.client_email,
    cases.client_phone,
    cases.opposite_party_name,
    cases.edited_html,
    cases.signed_pdf_storage_path,
    cases.signed_pdf_generated_at,
    cases.assigned_tehsil,
    cases.review_remarks,
    cases.reviewed_at,
    cases.reviewed_by_registrar_id,
    cases.status,
    cases.created_at,
    cases.updated_at,
    cases.submitted_at
  FROM cases
  JOIN case_types ON case_types.id = cases.case_type_id`;
}

export async function createCase({
  lawyerUserId,
  caseTypeId,
  title,
  description,
  clientName,
  clientEmail,
  clientPhone,
  clientUserId,
  oppositePartyName,
  assignedTehsil
}) {
  const caseType = await findCaseTypeById(caseTypeId);
  if (!caseType) {
    throw new ApiError(400, "Selected case type does not exist");
  }

  // Defence in depth: the validator already rejected an unsupported tehsil,
  // but re-check here so a future caller that bypasses the validator can't
  // route a case to a jurisdiction with no registrar. Absent/empty is fine —
  // the lawyer can pick it later, before submitting.
  if (assignedTehsil && !isSupportedTehsil(assignedTehsil)) {
    throw new ApiError(400, "Selected court/tehsil is not supported");
  }

  // Link the case to a registered client account when we can: prefer an
  // explicitly-provided clientUserId, else resolve the client by email. NULL
  // when neither matches — the free-text client_* columns below still capture
  // an unregistered client, so linking is purely additive.
  const resolvedClientUserId = await resolveClientUserId({
    clientUserId,
    clientEmail
  });

  const insertResult = await pool.query(
    `INSERT INTO cases (
      lawyer_user_id,
      case_type_id,
      title,
      description,
      client_name,
      client_email,
      client_phone,
      client_user_id,
      opposite_party_name,
      assigned_tehsil
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id`,
    [
      lawyerUserId,
      caseTypeId,
      title,
      description || null,
      clientName,
      clientEmail || null,
      clientPhone || null,
      resolvedClientUserId,
      oppositePartyName,
      assignedTehsil || null
    ]
  );

  const created = await pool.query(
    `${selectCaseWithType()} WHERE cases.id = $1`,
    [insertResult.rows[0].id]
  );

  // Best-effort audit event AFTER the insert has committed. Never throws
  // out here — a failed event write must not undo a successful create.
  await safeRecordCaseEvent({
    caseId: insertResult.rows[0].id,
    eventType: "created",
    actorUserId: lawyerUserId,
    actorRole: "lawyer",
    payload: {
      title,
      caseType: caseTypeId,
      assignedTehsil: assignedTehsil || null,
      clientName
    }
  });

  return mapCase(created.rows[0]);
}

export async function listCasesForLawyer({ lawyerUserId }) {
  const result = await pool.query(
    `${selectCaseWithType()}
    WHERE cases.lawyer_user_id = $1
    ORDER BY cases.updated_at DESC`,
    [lawyerUserId]
  );

  return result.rows.map(mapCase);
}

// Cases the lawyer owns where the background PDF compile has finished
// and stamped a signed_pdf_storage_path. Drives the dedicated "Signed
// Documents" tracker on /lawyer-signatures so the lawyer can preview /
// download every finalised artifact in one place — separate from the
// general /lawyer-cases listing (which mixes drafts, submissions,
// and in-progress work).
//
// Each row also carries `signed_by_roles` — the distinct set of signer
// roles whose signature_request reached status='signed'. The frontend
// uses it to render a "Client + Lawyer" / "Client only" / "Lawyer only"
// badge so the lawyer can tell apart self-signed artifacts from
// counter-signed ones at a glance.
export async function listSignedCasesForLawyer({ lawyerUserId }) {
  const result = await pool.query(
    `SELECT
      cases.id,
      cases.lawyer_user_id,
      cases.case_type_id,
      case_types.code           AS case_type_code,
      case_types.display_name   AS case_type_display_name,
      case_types.category       AS case_type_category,
      case_types.governing_law  AS case_type_governing_law,
      cases.title,
      cases.description,
      cases.client_name,
      cases.client_email,
      cases.client_phone,
      cases.opposite_party_name,
      cases.edited_html,
      cases.signed_pdf_storage_path,
      cases.signed_pdf_generated_at,
      cases.status,
      cases.created_at,
      cases.updated_at,
      cases.submitted_at,
      COALESCE(roles.signed_by_roles, ARRAY[]::text[]) AS signed_by_roles
    FROM cases
    JOIN case_types ON case_types.id = cases.case_type_id
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(DISTINCT signer_role) AS signed_by_roles
      FROM signature_requests
      WHERE signature_requests.case_id = cases.id
        AND signature_requests.status = 'signed'
    ) roles ON TRUE
    WHERE cases.lawyer_user_id = $1
      AND cases.signed_pdf_storage_path IS NOT NULL
    ORDER BY cases.signed_pdf_generated_at DESC NULLS LAST`,
    [lawyerUserId]
  );

  return result.rows.map((row) => ({
    ...mapCase(row),
    signedByRoles: Array.isArray(row.signed_by_roles)
      ? row.signed_by_roles.filter((r) => r === "client" || r === "lawyer")
      : []
  }));
}

// Lawyer dashboard stat tiles. Four small aggregate queries, every one scoped
// to the logged-in lawyer (cases.lawyer_user_id = $1) so a lawyer only ever
// counts their own work. Run in parallel — they touch independent indexes and
// none depends on another's result.
//
//   activeCases        — every case the lawyer owns, any status.
//   pendingSubmissions — cases sitting with the registrar (status='submitted').
//   clientSigned       — DISTINCT cases where the CLIENT signer has signed
//                        (signature_requests.signer_role='client' AND
//                        status='signed'). DISTINCT because one case can spawn
//                        several client signature_request rows.
//   totalEarnings      — this lawyer's NET earnings: their share of successful
//                        payment_transactions after the platform fee
//                        (SUM(lawyer_net_amount), COALESCE'd to amount for any
//                        pre-commission rows), scoped by lawyer_user_id. Matches
//                        the "Payments Received" page's "Your net earnings" so
//                        the two never disagree. Always a number (0 when the
//                        lawyer has no successful payments).
export async function getLawyerDashboardStats({ lawyerUserId }) {
  const [activeCases, pendingSubmissions, clientSigned, totalEarnings, ratingAgg] =
    await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM cases
         WHERE lawyer_user_id = $1`,
        [lawyerUserId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM cases
         WHERE lawyer_user_id = $1 AND status = 'submitted'`,
        [lawyerUserId]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT c.id)::int AS count
         FROM cases c
         JOIN signature_requests sr ON sr.case_id = c.id
         WHERE c.lawyer_user_id = $1
           AND sr.signer_role = 'client'
           AND sr.status = 'signed'`,
        [lawyerUserId]
      ),
      pool.query(
        // The lawyer's NET earnings — their share after the platform fee, not
        // the gross collected. COALESCE so pre-commission rows (no split
        // snapshot) count their full amount. Matches the Earnings page's
        // "Your net earnings" so the dashboard and that page never disagree.
        `SELECT COALESCE(SUM(COALESCE(lawyer_net_amount, amount)), 0)::float AS total
         FROM payment_transactions
         WHERE lawyer_user_id = $1 AND status = 'success'`,
        [lawyerUserId]
      ),
      // Average star rating across this lawyer's visible reviews (null = none yet).
      pool.query(
        `SELECT ROUND(AVG(lr.rating)::numeric, 1) AS avg
           FROM lawyer_reviews lr
           JOIN lawyer_profiles lp ON lp.id = lr.lawyer_profile_id
          WHERE lp.user_id = $1 AND lr.status <> 'hidden'`,
        [lawyerUserId]
      )
    ]);

  return {
    activeCases: activeCases.rows[0].count,
    pendingSubmissions: pendingSubmissions.rows[0].count,
    clientSigned: clientSigned.rows[0].count,
    totalEarnings: totalEarnings.rows[0].total,
    averageRating:
      ratingAgg.rows[0].avg !== null && ratingAgg.rows[0].avg !== undefined
        ? Number(ratingAgg.rows[0].avg)
        : null
  };
}

// Lawyer-scoped "Recent Activity" feed for the dashboard. A single UNION ALL
// over the real event sources, every branch scoped to the logged-in lawyer
// (cases.lawyer_user_id = $1), ordered newest-first and capped to 6 rows. We
// deliberately compute id, type, title and subject INSIDE each branch as plain
// columns so the outer query only has to ORDER BY ts DESC / LIMIT — no app-side
// merge sort, and the DB does the work. id = "<type>:<sourceRowId>" so each row
// has a stable React key even when two events share a timestamp.
//
// Event sources (no in-app messaging — that has no backend, so it's omitted):
//   case_submitted — cases.submitted_at  IS NOT NULL                (any status)
//   case_accepted  — cases.status='accepted' AND reviewed_at NOT NULL
//   case_returned  — cases.status='returned' AND reviewed_at NOT NULL
//   client_signed  — signature_requests joined to the lawyer's case where the
//                    CLIENT signer reached status='signed' (signed_at NOT NULL)
//
// The $1 placeholder is reused across every branch — node-postgres expands the
// single bound value to all positions, so this stays fully parameterised.
export async function getLawyerRecentActivity({ lawyerUserId }) {
  const result = await pool.query(
    `SELECT id, type, title, subject, ts AS timestamp
     FROM (
       SELECT
         'case_submitted:' || c.id::text AS id,
         'case_submitted'                AS type,
         'Case submitted to registrar'   AS title,
         c.title                         AS subject,
         c.submitted_at                  AS ts
       FROM cases c
       WHERE c.lawyer_user_id = $1
         AND c.submitted_at IS NOT NULL

       UNION ALL

       SELECT
         'case_accepted:' || c.id::text  AS id,
         'case_accepted'                 AS type,
         'Case approved by registrar'    AS title,
         c.title                         AS subject,
         c.reviewed_at                   AS ts
       FROM cases c
       WHERE c.lawyer_user_id = $1
         AND c.status = 'accepted'
         AND c.reviewed_at IS NOT NULL

       UNION ALL

       SELECT
         'case_returned:' || c.id::text   AS id,
         'case_returned'                  AS type,
         'Case returned for corrections'  AS title,
         c.title                          AS subject,
         c.reviewed_at                    AS ts
       FROM cases c
       WHERE c.lawyer_user_id = $1
         AND c.status = 'returned'
         AND c.reviewed_at IS NOT NULL

       UNION ALL

       SELECT
         'client_signed:' || sr.id::text AS id,
         'client_signed'                 AS type,
         'Document signed by client'     AS title,
         c.title                         AS subject,
         sr.signed_at                    AS ts
       FROM signature_requests sr
       JOIN cases c ON c.id = sr.case_id
       WHERE c.lawyer_user_id = $1
         AND sr.signer_role = 'client'
         AND sr.status = 'signed'
         AND sr.signed_at IS NOT NULL
     ) activity
     ORDER BY ts DESC
     LIMIT 6`,
    [lawyerUserId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    subject: row.subject,
    timestamp: row.timestamp
  }));
}

// Lawyer "Returned Cases" page data — the lawyer's cases the registrar sent
// back (status='returned'), newest-decision first, enriched with the return
// reason, client info, attachment count, and the case fee/paid from the
// payments tables. There is NO "progress" concept in the system, so none is
// returned. caseFee is null when the case has no fee agreement; paidAmount is
// null in that case too (the page hides the fee/paid block). Scoped to the
// lawyer; parameterised SQL only.
export async function getReturnedCasesForLawyer({ lawyerUserId }) {
  const result = await pool.query(
    `SELECT
       c.id,
       c.title,
       c.description,
       ct.display_name AS case_type_name,
       ct.category     AS category,
       c.review_remarks,
       c.reviewed_at,
       c.submitted_at,
       c.client_name,
       c.client_email,
       c.client_phone,
       (SELECT COUNT(*) FROM case_attachments ca WHERE ca.case_id = c.id)::int
         AS document_count,
       ag.agreed_total_amount::float AS case_fee,
       (SELECT COALESCE(SUM(pt.amount), 0)::float
          FROM payment_transactions pt
         WHERE pt.case_id = c.id AND pt.status = 'success') AS paid_amount
     FROM cases c
     JOIN case_types ct ON ct.id = c.case_type_id
     LEFT JOIN agreements ag ON ag.case_id = c.id
     WHERE c.lawyer_user_id = $1
       AND c.status = 'returned'
     ORDER BY c.reviewed_at DESC NULLS LAST`,
    [lawyerUserId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    caseTypeName: row.case_type_name,
    category: row.category,
    reviewRemarks: row.review_remarks,
    reviewedAt: row.reviewed_at,
    submittedAt: row.submitted_at,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    documentCount: row.document_count,
    caseFee: row.case_fee,
    paidAmount: row.case_fee === null ? null : row.paid_amount
  }));
}

export async function getCaseForLawyer({ caseId, lawyerUserId }) {
  const result = await pool.query(
    `${selectCaseWithType()}
    WHERE cases.id = $1 AND cases.lawyer_user_id = $2`,
    [caseId, lawyerUserId]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "Case not found");
  }

  return mapCase(result.rows[0]);
}

// Submit a case to the registrar for review. Allowed only from 'draft' or
// 'returned' (a returned case can be fixed and resubmitted). Both prerequisites
// — a chosen tehsil and a compiled signed PDF — must be present, otherwise we
// surface a specific 400 telling the lawyer which step is missing. On success
// the case moves to 'submitted' and is stamped with submitted_at so the
// registrar queue can order by oldest-first.
export async function submitCase({ caseId, lawyerUserId }) {
  const result = await pool.query(
    `SELECT status, assigned_tehsil, signed_pdf_storage_path, title
     FROM cases
     WHERE id = $1 AND lawyer_user_id = $2`,
    [caseId, lawyerUserId]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "Case not found");
  }

  const { status, assigned_tehsil, signed_pdf_storage_path, title } = result.rows[0];

  if (status !== "draft" && status !== "returned") {
    throw new ApiError(409, "Only draft or returned cases can be submitted");
  }

  if (!assigned_tehsil) {
    throw new ApiError(400, "Select a court/tehsil before submitting");
  }

  if (!signed_pdf_storage_path) {
    throw new ApiError(400, "Sign the case file before submitting");
  }

  await pool.query(
    `UPDATE cases
     SET status = 'submitted',
         submitted_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND lawyer_user_id = $2`,
    [caseId, lawyerUserId]
  );

  // Best-effort audit event AFTER the status=submitted UPDATE commits. The
  // CURRENT status (captured above, before the UPDATE) decides whether this
  // is a first submission (draft -> submitted) or a resubmission of a case
  // the registrar bounced back (returned -> submitted).
  const isResubmit = status === "returned";
  await safeRecordCaseEvent({
    caseId,
    eventType: isResubmit ? "resubmitted" : "submitted",
    actorUserId: lawyerUserId,
    actorRole: "lawyer",
    payload: {
      fromStatus: isResubmit ? "returned" : "draft",
      toStatus: "submitted",
      assignedTehsil: assigned_tehsil
    }
  });

  // Best-effort: alert the registrar(s) of this tehsil that a case is awaiting
  // review — an in-app bell ping (always) plus a "case" email (gated by each
  // registrar's own preference). Never breaks submit.
  try {
    const registrars = await pool.query(
      `SELECT u.id, u.email, u.first_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       JOIN registrar_profiles rp ON rp.user_id = u.id
       WHERE r.name = 'registrar'
         AND LOWER(rp.assigned_tehsil) = LOWER($1)`,
      [assigned_tehsil]
    );
    const safeTitle = title ?? "the case";
    for (const reg of registrars.rows) {
      // Per-recipient best-effort: a transient failure for one registrar must
      // not skip the rest of the tehsil's registrars.
      try {
        await createNotification({
          userId: reg.id,
          type: "case_submitted",
          title: isResubmit ? "Case resubmitted for review" : "New case awaiting review",
          message: `Case "${safeTitle}" was ${
            isResubmit ? "resubmitted" : "submitted"
          } in your tehsil and is awaiting your review.`,
          caseId
        });
        // Gated email: only fires if this registrar's "case" preference is on
        // (master + category). Fire-and-forget; the bell ping above is the
        // authoritative alert.
        if (reg.email) {
          queueNotificationEmail({
            email: reg.email,
            firstName: reg.first_name,
            userId: reg.id,
            category: "case",
            subject: isResubmit
              ? `Case resubmitted for review — ${safeTitle}`
              : `New case awaiting review — ${safeTitle}`,
            heading: isResubmit
              ? "Case Resubmitted for Review"
              : "New Case Awaiting Review",
            intro: `The case "${safeTitle}" was ${
              isResubmit ? "resubmitted" : "submitted"
            } in your tehsil and is awaiting your review.`,
            caseTitle: safeTitle,
            detailLabel: "Status",
            detailValue: isResubmit ? "Resubmitted for review" : "Awaiting review",
            footerNote: "Open LawFlow to review the case."
          });
        }
      } catch (notifyErr) {
        console.error(
          `Failed to notify registrar ${reg.id} of submission:`,
          notifyErr?.message ?? notifyErr
        );
      }
    }
  } catch (err) {
    console.error(
      "Failed to notify registrars of submission:",
      err?.message ?? err
    );
  }

  return getCaseForLawyer({ caseId, lawyerUserId });
}

// Patch a subset of fields on an editable case. Only fields present in
// `updates` are written — undefined keys are skipped so callers can PATCH
// partial payloads. Editing is allowed while the case is 'draft' OR 'returned'
// (a returned case must be fixable before resubmission); once 'submitted' or
// 'accepted' the case is locked so the registrar review stays immutable.
export async function updateCase({ caseId, lawyerUserId, updates }) {
  const allowed = {
    title: "title",
    description: "description",
    clientName: "client_name",
    clientEmail: "client_email",
    clientPhone: "client_phone",
    oppositePartyName: "opposite_party_name",
    assignedTehsil: "assigned_tehsil"
  };

  // Guard the tehsil the same way createCase does — an edited case must not be
  // routed to a jurisdiction with no registrar. isSupportedTehsil() treats
  // empty/undefined as valid, so clearing the field (→ NULL) stays allowed.
  if (
    updates.assignedTehsil !== undefined &&
    !isSupportedTehsil(updates.assignedTehsil)
  ) {
    throw new ApiError(400, "Selected court/tehsil is not supported");
  }

  const setExpressions = [];
  const values = [];
  const changedFields = [];
  let paramIndex = 1;

  for (const [key, column] of Object.entries(allowed)) {
    if (updates[key] === undefined) continue;
    setExpressions.push(`${column} = $${paramIndex++}`);
    values.push(updates[key] === "" ? null : updates[key]);
    changedFields.push(key);
  }

  if (setExpressions.length === 0) {
    return getCaseForLawyer({ caseId, lawyerUserId });
  }

  setExpressions.push("updated_at = NOW()");

  values.push(caseId);
  values.push(lawyerUserId);

  const result = await pool.query(
    `UPDATE cases
     SET ${setExpressions.join(", ")}
     WHERE id = $${paramIndex++}
       AND lawyer_user_id = $${paramIndex++}
       AND status IN ('draft', 'returned')
     RETURNING id`,
    values
  );

  if (result.rowCount === 0) {
    // Either the case does not exist, belongs to a different lawyer, or has
    // already been submitted/returned/accepted. Don't leak which.
    throw new ApiError(404, "Case not found or no longer editable");
  }

  // Best-effort audit event AFTER the guarded UPDATE succeeds. Record only
  // the KEYS that were actually applied (never the values — they can carry
  // client PII). Never throws out here.
  await safeRecordCaseEvent({
    caseId,
    eventType: "edited",
    actorUserId: lawyerUserId,
    actorRole: "lawyer",
    payload: { changedFields }
  });

  return getCaseForLawyer({ caseId, lawyerUserId });
}

// Hard-delete a case the lawyer owns. This is a permanent, irreversible
// removal of the row — there is no soft-delete column to flip. Allowed at
// ANY status (the lawyer explicitly asked for a full hard delete), so no
// status guard here.
//
// Ownership is enforced IN the DELETE's WHERE clause (id + lawyer_user_id),
// so a lawyer can only ever delete their own case and we never need a
// separate ownership SELECT. rowCount 0 means the case either doesn't exist
// or belongs to another lawyer — both collapse to a 404 so we don't leak
// existence-vs-access.
//
// Dependents are removed by ON DELETE CASCADE FKs to cases(id):
// case_attachments, signature_requests, notifications, agreements (→
// payment_plans → installments), payment_transactions, payment_receipts.
// In the current schema EVERY FK to cases(id) cascades, so the delete
// succeeds cleanly. Defence in depth: if a deployment has (or later adds)
// an FK with ON DELETE RESTRICT/NO ACTION, the DELETE raises a
// foreign_key_violation (SQLSTATE 23503); we catch that and surface a clean
// 409 instead of a 500.
//
// Storage cleanup is best-effort and happens AFTER the row is gone: we read
// the signed-PDF path + every attachment storage path BEFORE the delete (the
// rows vanish with the cascade), then sweep the objects. A storage failure
// never fails the delete — the swallowing lives in the storage helpers, and
// we additionally guard the whole sweep so an unexpected throw can't bubble.
export async function deleteCaseForLawyer({ caseId, lawyerUserId }) {
  // Block the delete while a payment plan still exists for this case. A plan
  // means the client could be mid-payment (deleting would strand their money or
  // wipe the schedule), and a plan can hold recorded payments whose history must
  // be kept. The lawyer must remove the payment plan first — and removing a plan
  // is itself refused once anything has been paid, so a paid case can never be
  // deleted. Scoped to the owning lawyer so a non-owner can't probe other cases:
  // for them this finds nothing and the DELETE below 404s instead.
  const hasPlan = await pool.query(
    `SELECT 1
     FROM agreements a
     JOIN cases c ON c.id = a.case_id
     WHERE a.case_id = $1
       AND c.lawyer_user_id = $2
     LIMIT 1`,
    [caseId, lawyerUserId]
  );
  if (hasPlan.rows.length > 0) {
    throw new ApiError(
      409,
      "Remove the payment plan before deleting this case."
    );
  }

  // Block delete if the case has any hearings scheduled or recorded
  const hasHearings = await pool.query(
    `SELECT 1
     FROM hearings
     WHERE case_id = $1
     LIMIT 1`,
    [caseId]
  );
  if (hasHearings.rows.length > 0) {
    throw new ApiError(
      409,
      "This case has hearings scheduled or recorded and cannot be deleted."
    );
  }

  // Capture the storage paths we'll want to sweep, scoped to the owning
  // lawyer so a non-owner learns nothing. If the case isn't theirs we get
  // zero rows and fall through to the 404 below after the DELETE no-ops.
  const pdfPathResult = await pool.query(
    `SELECT signed_pdf_storage_path
     FROM cases
     WHERE id = $1 AND lawyer_user_id = $2`,
    [caseId, lawyerUserId]
  );

  const attachmentPathsResult = await pool.query(
    `SELECT ca.storage_path
     FROM case_attachments ca
     JOIN cases ON cases.id = ca.case_id
     WHERE ca.case_id = $1 AND cases.lawyer_user_id = $2`,
    [caseId, lawyerUserId]
  );

  let deleteResult;
  try {
    deleteResult = await pool.query(
      `DELETE FROM cases
       WHERE id = $1 AND lawyer_user_id = $2`,
      [caseId, lawyerUserId]
    );
  } catch (err) {
    // 23503 = foreign_key_violation. Reached only if some FK to cases(id) is
    // ON DELETE RESTRICT/NO ACTION (e.g. a payments/agreements constraint a
    // deployment changed). Turn the raw PG error into a clean 409 so the UI
    // can explain it, rather than a generic 500.
    if (err && err.code === "23503") {
      throw new ApiError(
        409,
        "This case has linked records (e.g. payments) and cannot be deleted"
      );
    }
    throw err;
  }

  if (deleteResult.rowCount === 0) {
    // Not found, or owned by a different lawyer — don't distinguish.
    throw new ApiError(404, "Case not found");
  }

  // Best-effort storage sweep AFTER the row (and its cascaded rows) are gone.
  // Never let a storage hiccup undo / fail a completed delete: each helper
  // already swallows its own errors, and the try/catch is a final backstop.
  try {
    const signedPdfPath = pdfPathResult.rows[0]?.signed_pdf_storage_path;
    if (signedPdfPath) {
      await deleteSignedCasePdf(signedPdfPath);
    }

    await Promise.all(
      attachmentPathsResult.rows
        .map((row) => row.storage_path)
        .filter(Boolean)
        .map((storagePath) => deleteCaseAttachmentObject(storagePath))
    );
  } catch (storageErr) {
    // Orphaned objects are reconciled out-of-band; the delete itself stands.
    console.error("[STORAGE CLEANUP FAILED]", {
      task: "delete-case-storage",
      caseId,
      message: storageErr?.message
    });
  }
}

// =====================================================================
// Case attachments
// =====================================================================

async function mapCaseAttachment(row) {
  // Mint a fresh signed URL on every map call. TTL is 1 hour — the
  // editor uses it as the <img src> in the saved HTML, but on case
  // re-open we re-fetch the list and rewrite the DOM with the
  // latest URLs, so expiry is invisible to the user.
  const signed = row.storage_path
    ? await getCaseAttachmentSignedUrl(row.storage_path)
    : null;
  return {
    id: row.id,
    caseId: row.case_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size !== null && row.file_size !== undefined
      ? Number(row.file_size)
      : null,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    createdAt: row.created_at,
    url: signed,
  };
}

// Ownership check — every attachment endpoint runs through this so
// a lawyer can only touch attachments on their own cases. Returns
// the case id when valid, throws 404 otherwise. Matches the pattern
// the rest of cases.service.js uses (don't leak existence-vs-access).
async function assertCaseOwnership({ caseId, lawyerUserId }) {
  const result = await pool.query(
    `SELECT id FROM cases WHERE id = $1 AND lawyer_user_id = $2`,
    [caseId, lawyerUserId]
  );
  if (result.rowCount === 0) {
    throw new ApiError(404, "Case not found");
  }
  return result.rows[0].id;
}

export async function uploadAttachmentToCase({
  caseId,
  lawyerUserId,
  file,
}) {
  if (!file) {
    throw new ApiError(400, "Attachment file is required");
  }

  await assertCaseOwnership({ caseId, lawyerUserId });

  // Generate the attachment UUID up front so the storage path is
  // predictable BEFORE the DB insert. Two reasons:
  //   1. The path includes the attachmentId; we need it for upload
  //   2. If the upload succeeds but the INSERT fails, we know the
  //      exact orphan path to clean up
  const idResult = await pool.query("SELECT gen_random_uuid() AS id");
  const attachmentId = idResult.rows[0].id;

  const { storageBucket, storagePath } = await uploadCaseAttachmentObject({
    caseId,
    attachmentId,
    fileBuffer: file.buffer,
    mimeType: file.mimetype,
    originalName: file.originalname,
  });

  try {
    const inserted = await pool.query(
      `INSERT INTO case_attachments (
         id, case_id, uploaded_by_user_id,
         file_name, mime_type, file_size,
         storage_bucket, storage_path
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        attachmentId,
        caseId,
        lawyerUserId,
        file.originalname || "file",
        file.mimetype,
        file.size,
        storageBucket,
        storagePath,
      ]
    );

    return mapCaseAttachment(inserted.rows[0]);
  } catch (err) {
    // Roll back the storage upload so we don't leave an orphan
    // object behind. Best-effort — the cleanup helper swallows its
    // own errors, so this never re-throws above the original.
    await deleteCaseAttachmentObject(storagePath);
    throw err;
  }
}

export async function listCaseAttachments({ caseId, lawyerUserId }) {
  await assertCaseOwnership({ caseId, lawyerUserId });

  const result = await pool.query(
    `SELECT *
     FROM case_attachments
     WHERE case_id = $1
     ORDER BY created_at ASC`,
    [caseId]
  );

  return Promise.all(result.rows.map(mapCaseAttachment));
}

export async function deleteCaseAttachment({
  caseId,
  attachmentId,
  lawyerUserId,
}) {
  await assertCaseOwnership({ caseId, lawyerUserId });

  // Single-statement delete that doubles as the lookup so we know
  // the storage path to clean up afterwards. RETURNING gives us the
  // row before the row is gone; if the case_id doesn't match the
  // attachment's case_id we surface 404.
  const result = await pool.query(
    `DELETE FROM case_attachments
     WHERE id = $1 AND case_id = $2
     RETURNING storage_path`,
    [attachmentId, caseId]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "Attachment not found");
  }

  // Best-effort storage cleanup — leaving an orphan object is far
  // better than blocking the user's delete click. Same convention
  // as the avatar deletion path.
  await deleteCaseAttachmentObject(result.rows[0].storage_path);
}
