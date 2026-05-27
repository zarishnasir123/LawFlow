import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import {
  deleteCaseAttachment as deleteCaseAttachmentObject,
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
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at
  };
}

export async function listCaseTypes() {
  const result = await pool.query(
    `SELECT id, category, code, display_name, governing_law, sort_order
     FROM case_types
     ORDER BY category, sort_order, display_name`
  );

  return result.rows.map(mapCaseType);
}

async function findCaseTypeById(caseTypeId) {
  const result = await pool.query(
    "SELECT id FROM case_types WHERE id = $1",
    [caseTypeId]
  );

  return result.rows[0] || null;
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
    `SELECT code, category, display_name
     FROM case_types
     WHERE code = $1`,
    [code]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "Case type not found");
  }

  const row = result.rows[0];
  const filePath = path.resolve(CASE_TEMPLATES_DIR, row.category, `${row.code}.docx`);

  if (!filePath.startsWith(CASE_TEMPLATES_DIR + path.sep)) {
    // Path-traversal guard. Should never trigger because category + code are
    // DB-controlled, but bail before touching the filesystem if anything is
    // off (e.g., schema seed accidentally inserts ".." in category).
    throw new ApiError(500, "Invalid template path");
  }

  try {
    await fs.access(filePath);
  } catch {
    // DB has the case type but the .docx hasn't been generated on this host.
    // Run `npm run generate:case-templates` once and the file will appear.
    throw new ApiError(404, "Template file is not available on the server");
  }

  return {
    filePath,
    fileName: `${row.code}.docx`,
    displayName: row.display_name,
    category: row.category
  };
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
  oppositePartyName
}) {
  const caseType = await findCaseTypeById(caseTypeId);
  if (!caseType) {
    throw new ApiError(400, "Selected case type does not exist");
  }

  const insertResult = await pool.query(
    `INSERT INTO cases (
      lawyer_user_id,
      case_type_id,
      title,
      description,
      client_name,
      client_email,
      client_phone,
      opposite_party_name
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,
    [
      lawyerUserId,
      caseTypeId,
      title,
      description || null,
      clientName,
      clientEmail || null,
      clientPhone || null,
      oppositePartyName
    ]
  );

  const created = await pool.query(
    `${selectCaseWithType()} WHERE cases.id = $1`,
    [insertResult.rows[0].id]
  );

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

// Patch a subset of fields on a draft case. Only fields present in `updates`
// are written — undefined keys are skipped so callers can PATCH partial
// payloads. Locked to draft status to keep the registrar review immutable
// once submitted.
export async function updateCase({ caseId, lawyerUserId, updates }) {
  const allowed = {
    title: "title",
    description: "description",
    clientName: "client_name",
    clientEmail: "client_email",
    clientPhone: "client_phone",
    oppositePartyName: "opposite_party_name"
  };

  const setExpressions = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, column] of Object.entries(allowed)) {
    if (updates[key] === undefined) continue;
    setExpressions.push(`${column} = $${paramIndex++}`);
    values.push(updates[key] === "" ? null : updates[key]);
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
       AND status = 'draft'
     RETURNING id`,
    values
  );

  if (result.rowCount === 0) {
    // Either the case does not exist, belongs to a different lawyer, or has
    // already been submitted/returned/accepted. Don't leak which.
    throw new ApiError(404, "Case not found or no longer editable");
  }

  return getCaseForLawyer({ caseId, lawyerUserId });
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
