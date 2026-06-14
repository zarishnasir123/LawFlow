import { pool } from "../../config/db.js";

// =====================================================================
// Case events — append-only lifecycle audit trail writer.
//
// One row per meaningful thing that happens to a case (created,
// submitted/resubmitted, returned, accepted, signed_pdf_compiled,
// edited, ...). These rows feed the admin case-traceability timeline;
// they are a read-time convenience, NEVER a source of truth the app
// branches on. The two signing events (client_signed / lawyer_signed)
// are derived at read-time from signature_requests and are NOT written
// here.
//
// All SQL is parameterised. The single INSERT accepts an optional pg
// client so a caller already inside a transaction can have the event
// ride the same connection (and roll back with it); when no client is
// passed it falls back to the shared pool.
// =====================================================================

// Insert one case_event row. Returns the inserted id. Parameterised SQL
// only — payload is bound as JSONB ($5) so arbitrary keys/values can
// never reach the SQL string.
//
// `client ?? pool` lets this either ride an open transaction (pass the
// pg client) or run standalone (omit it). The payload defaults to an
// empty object so the NOT NULL JSONB column is always satisfied.
export async function recordCaseEvent(
  { caseId, eventType, actorUserId = null, actorRole = null, payload = {} },
  client
) {
  const executor = client ?? pool;

  const result = await executor.query(
    `INSERT INTO case_events (
       case_id,
       event_type,
       actor_user_id,
       actor_role,
       payload
     )
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id`,
    [
      caseId,
      eventType,
      actorUserId,
      actorRole,
      JSON.stringify(payload ?? {})
    ]
  );

  return result.rows[0].id;
}

// BEST-EFFORT wrapper around recordCaseEvent. A failed event write MUST
// NEVER break the underlying action (case create / submit / review /
// compile / edit), so this swallows any error and only console.errors a
// non-PII line. Mirrors the notifyLawyerOfTransition convention in
// registrarReview.service.js. Hooks call THIS, awaited, after the
// primary write has already committed.
export async function safeRecordCaseEvent(args, client) {
  try {
    await recordCaseEvent(args, client);
  } catch (error) {
    // Log enough to debug, but never the payload (it can carry the case
    // title / client name). The action it accompanies has already
    // succeeded — losing the audit row is non-fatal.
    console.error(
      `Failed to record case event "${args?.eventType}" for case ${args?.caseId}:`,
      error?.message ?? error
    );
  }
}
