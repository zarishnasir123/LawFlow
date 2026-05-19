import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";

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
