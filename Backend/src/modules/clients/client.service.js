import { pool } from "../../config/db.js";

// Shape a `cases` row (joined to case_types + the owning lawyer) into the
// read-only ClientCase the client's "My Cases" view consumes.
//
// Deliberately HIGH-LEVEL: this is a status tracker, not the full case record.
// We never surface the registrar's internal review_remarks, the signed PDF
// path, the lawyer's edited_html, or attachments — the client only needs to
// know what their case is, who their lawyer is, and where it stands.
function mapClientCase(row) {
  return {
    id: row.id,
    title: row.title,
    caseTypeLabel: row.case_type_display_name,
    category: row.case_type_category,
    status: row.status,
    lawyerName: [row.lawyer_first_name, row.lawyer_last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || null,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at
  };
}

// Every case linked to this client account, newest first. Ownership is enforced
// in SQL via cases.client_user_id = $1 so a client can never read another
// client's cases — the parameter comes straight from the verified JWT
// (req.user.sub) in the controller. Parameterised SQL only.
//
// SELECT is intentionally narrow: only the columns mapClientCase needs. The
// registrar review trail (review_remarks), signed PDF metadata, edited_html,
// and case attachments are never selected here, so they cannot leak to the
// client even by accident.
export async function listCasesForClient({ clientUserId }) {
  const result = await pool.query(
    `SELECT
       cases.id,
       cases.title,
       cases.status,
       cases.created_at,
       cases.submitted_at,
       cases.reviewed_at,
       case_types.display_name AS case_type_display_name,
       case_types.category     AS case_type_category,
       lawyer.first_name       AS lawyer_first_name,
       lawyer.last_name        AS lawyer_last_name
     FROM cases
     JOIN case_types ON case_types.id = cases.case_type_id
     LEFT JOIN users AS lawyer ON lawyer.id = cases.lawyer_user_id
     WHERE cases.client_user_id = $1
     ORDER BY cases.created_at DESC`,
    [clientUserId]
  );

  return result.rows.map(mapClientCase);
}
