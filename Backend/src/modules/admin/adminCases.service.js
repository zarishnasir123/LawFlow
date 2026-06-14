import { pool } from "../../config/db.js";

// =====================================================================
// Admin case traceability service.
//
// Two read-only endpoints back the admin "Case Tracking" screens:
//
//   listAdminCases    -> the paginated/searchable case table
//   getAdminCaseDetail-> one case's facts + a merged audit timeline +
//                        a payment-readiness summary
//
// Everything here is parameterised SQL (no string interpolation of
// user input, status literals, or LIMIT/OFFSET). The list query reuses
// the COUNT(*) OVER () AS total_count + { items, pagination } shape from
// auth.service.js listLawyerVerificationsByStatus so the admin app's
// pagination behaves identically across screens.
//
// Money columns (agreements.agreed_total_amount, lawyer_base_fee, the
// SUM of payment_transactions.amount) come back from pg as strings
// (NUMERIC is not coerced to JS number to avoid precision loss). We
// convert them to numbers / null at the mapping boundary via toMoney()
// so the JSON contract is { number | null }, never a string.
// =====================================================================

// The four lifecycle statuses an admin can filter the case table by.
// Mirrors the allow-list discipline in registrarReview.validators.js;
// the validator rejects anything outside this set with a 400 before we
// ever reach the DB, but we keep the constant here as the single source
// of truth the validator imports.
export const ADMIN_CASE_STATUSES = ["draft", "submitted", "returned", "accepted"];

// NUMERIC -> JS number | null. node-postgres returns NUMERIC as a string
// to preserve precision; the contract wants a real number (or null when
// the source row/column is absent). SUM over zero rows is NULL, so a
// case with no successful payments yields paidAmount 0 (see the COALESCE
// in the subquery) rather than null.
function toMoney(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// The column list shared by the list endpoint and the detail endpoint's
// `case` facts block, so both surface byte-identical AdminCaseListItem
// fields. Aliased to the snake_case the mapper expects.
//
//   * caseType / category come from the case_types catalog row.
//   * lawyerName joins users on cases.lawyer_user_id (always present:
//     lawyer_user_id is NOT NULL).
//   * registrarName LEFT JOINs users on reviewed_by_registrar_id (NULL
//     until a registrar actions the case, and nulls out if that
//     registrar account is later deleted).
//   * agreedFee / agreementStatus / lawyerBaseFee come from the 1:1
//     agreements row (case_id is UNIQUE) via LEFT JOIN, so a case with
//     no agreement still returns one row with those columns NULL.
//   * paidAmount is a correlated subquery summing only status='success'
//     transactions, COALESCEd to 0 so "no payments" reads as 0 not null.
//
// Split into a column list (CASE_FACTS_COLUMNS) and a FROM/JOIN tail
// (CASE_FACTS_FROM) so the list query can splice an extra
// `COUNT(*) OVER () AS total_count` window column into the SELECT list
// (it must sit before FROM) without the detail query carrying it.
const CASE_FACTS_COLUMNS = `
    c.id,
    c.title,
    ct.display_name              AS case_type,
    ct.category                  AS category,
    TRIM(lu.first_name || ' ' || lu.last_name) AS lawyer_name,
    lu.email                     AS lawyer_email,
    lu.phone                     AS lawyer_phone,
    c.client_name,
    c.client_email,
    c.client_phone,
    c.status,
    c.assigned_tehsil,
    c.created_at,
    c.submitted_at,
    c.reviewed_at,
    CASE
      WHEN ru.id IS NOT NULL
        THEN TRIM(ru.first_name || ' ' || ru.last_name)
      ELSE NULL
    END                          AS registrar_name,
    a.id                         AS agreement_id,
    a.agreed_total_amount        AS agreed_fee,
    a.lawyer_base_fee            AS lawyer_base_fee,
    a.status                     AS agreement_status,
    COALESCE((
      SELECT SUM(pt.amount)
        FROM payment_transactions pt
       WHERE pt.case_id = c.id
         AND pt.status = 'success'
    ), 0)                        AS paid_amount
`;

const CASE_FACTS_FROM = `
  FROM cases c
  JOIN case_types ct ON ct.id = c.case_type_id
  JOIN users lu      ON lu.id = c.lawyer_user_id
  LEFT JOIN users ru ON ru.id = c.reviewed_by_registrar_id
  LEFT JOIN agreements a ON a.case_id = c.id
`;

// Row (from CASE_FACTS_SELECT) -> AdminCaseListItem (camelCase JSON).
// hasAgreement is derived from whether the LEFT JOIN matched an
// agreements row (agreement_id present), NOT from agreedFee being
// non-null, so a (hypothetical) zero-fee agreement still reads as
// "has agreement".
function mapCaseFacts(row) {
  return {
    id: row.id,
    title: row.title,
    caseType: row.case_type,
    category: row.category,
    lawyerName: row.lawyer_name,
    lawyerEmail: row.lawyer_email,
    lawyerPhone: row.lawyer_phone,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    status: row.status,
    assignedTehsil: row.assigned_tehsil,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    registrarName: row.registrar_name,
    agreedFee: toMoney(row.agreed_fee),
    paidAmount: toMoney(row.paid_amount) ?? 0,
    hasAgreement: row.agreement_id !== null && row.agreement_id !== undefined
  };
}

// GET /api/admin/cases
// -> { items: AdminCaseListItem[], pagination: { total, limit, offset } }
//
// limit  : default 20, clamped to 1..100
// offset : default 0, floored at 0
// status : optional; must already be in ADMIN_CASE_STATUSES (validator-
//          enforced). When omitted, all statuses are returned.
// search : optional; case-insensitive ILIKE over the case title, the
//          stored client_name, and the lawyer's "First Last" name.
//
// Pagination total comes from COUNT(*) OVER () AS total_count computed in
// the same windowed pass — no second COUNT round-trip — matching
// listLawyerVerificationsByStatus.
export async function listAdminCases({ search, status, limit, offset } = {}) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
  const safeOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);

  // Build the WHERE clause and the parameter array in lockstep so the
  // $-placeholders always line up with values. $1 and $2 are reserved
  // for LIMIT/OFFSET; the optional filters take $3 onward.
  const params = [safeLimit, safeOffset];
  const conditions = [];

  if (status) {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }

  if (search && search.trim() !== "") {
    params.push(`%${search.trim()}%`);
    const p = `$${params.length}`;
    conditions.push(`(
      c.title ILIKE ${p}
      OR c.client_name ILIKE ${p}
      OR TRIM(lu.first_name || ' ' || lu.last_name) ILIKE ${p}
    )`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  // total_count is a window column in the SAME pass (no second COUNT
  // round-trip). It sits in the SELECT list before FROM; the WHERE filters
  // the window's frame, so the count reflects the filtered set, not the
  // whole table.
  const result = await pool.query(
    `SELECT
       ${CASE_FACTS_COLUMNS},
       COUNT(*) OVER () AS total_count
     ${CASE_FACTS_FROM}
     ${whereClause}
     ORDER BY c.created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );

  // Guard: if zero rows match, there is no row to read total_count from,
  // so the total is 0.
  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;

  return {
    items: result.rows.map(mapCaseFacts),
    pagination: {
      total,
      limit: safeLimit,
      offset: safeOffset
    }
  };
}

// GET /api/admin/cases/:caseId
// -> { case, timeline, paymentReadiness } | throws ApiError(404)
//
// The caller (controller) translates a null return into a 404; here we
// just return null when the case id matches nothing.
//
// timeline = the case_events audit rows (real, append-only) MERGED IN JS
// with derived signing rows (computed at read-time from
// signature_requests, never stored as events). See buildTimeline below
// for the merge/sort. Oldest-first.
export async function getAdminCaseDetail(caseId) {
  // 1) Case facts (same column list as the list, single row by id).
  const caseResult = await pool.query(
    `SELECT
       ${CASE_FACTS_COLUMNS}
     ${CASE_FACTS_FROM}
     WHERE c.id = $1
     LIMIT 1`,
    [caseId]
  );

  if (caseResult.rows.length === 0) {
    return null;
  }

  const caseRow = caseResult.rows[0];
  const caseFacts = mapCaseFacts(caseRow);

  // 2) Real audit events for this case, oldest-first. LEFT JOIN users to
  //    resolve the actor's display name (actor_user_id nulls out if the
  //    user is deleted, so actorName can legitimately be null).
  const eventsResult = await pool.query(
    `SELECT
       ce.id,
       ce.event_type,
       ce.actor_role,
       ce.payload,
       ce.created_at,
       CASE
         WHEN au.id IS NOT NULL
           THEN TRIM(au.first_name || ' ' || au.last_name)
         ELSE NULL
       END AS actor_name
     FROM case_events ce
     LEFT JOIN users au ON au.id = ce.actor_user_id
     WHERE ce.case_id = $1
     ORDER BY ce.created_at ASC`,
    [caseId]
  );

  // 3) Derived signing events: one timeline node per COMPLETED signature
  //    request (status='signed' with a real signed_at). signer_role maps
  //    to the event_type the frontend renders. recipient_user_id is the
  //    signer, so we JOIN users on it for the signer's name.
  const signingResult = await pool.query(
    `SELECT
       sr.id,
       sr.signer_role,
       sr.signed_at,
       CASE
         WHEN su.id IS NOT NULL
           THEN TRIM(su.first_name || ' ' || su.last_name)
         ELSE NULL
       END AS signer_name
     FROM signature_requests sr
     LEFT JOIN users su ON su.id = sr.recipient_user_id
     WHERE sr.case_id = $1
       AND sr.status = 'signed'
       AND sr.signed_at IS NOT NULL`,
    [caseId]
  );

  const timeline = buildTimeline(eventsResult.rows, signingResult.rows);

  // 4) Payment readiness. payoutEligible is the read-only indicator the
  //    admin UI surfaces as the FUTURE payout trigger (no action here):
  //    true only when the case has been accepted by a registrar AND has a
  //    real review timestamp.
  const paymentReadiness = {
    hasAgreement: caseFacts.hasAgreement,
    agreedFee: caseFacts.agreedFee,
    lawyerBaseFee: toMoney(caseRow.lawyer_base_fee),
    paidAmount: caseFacts.paidAmount,
    agreementStatus: caseRow.agreement_status ?? null,
    payoutEligible:
      caseFacts.status === "accepted" && caseFacts.reviewedAt !== null
  };

  return {
    case: caseFacts,
    timeline,
    paymentReadiness
  };
}

// Merge real case_events rows with derived signing rows into one
// chronological, oldest-first timeline.
//
//   * event rows  -> id "evt:<uuid>", payload passed through as stored.
//   * signing rows-> id "sig:<uuid>", synthesised payload { signerRole }.
//
// Both branches produce the SAME CaseTimelineEvent shape:
//   { id, eventType, actorName, actorRole, payload, createdAt }
//
// Sort key is createdAt ASC. Date parsing tolerates both Date objects
// (pg returns TIMESTAMP as a JS Date) and ISO strings.
function buildTimeline(eventRows, signingRows) {
  const eventNodes = eventRows.map((row) => ({
    id: `evt:${row.id}`,
    eventType: row.event_type,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    payload: row.payload ?? {},
    createdAt: row.created_at
  }));

  const signingNodes = signingRows.map((row) => ({
    id: `sig:${row.id}`,
    eventType: row.signer_role === "client" ? "client_signed" : "lawyer_signed",
    actorName: row.signer_name,
    actorRole: row.signer_role,
    payload: { signerRole: row.signer_role },
    createdAt: row.signed_at
  }));

  return [...eventNodes, ...signingNodes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}
