import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import { findNextAvailableSlot, getNextHearingStage } from "./hearingScheduler.js";
import { createNotification } from "../notifications/notifications.service.js";
import { safeRecordCaseEvent } from "../cases/caseEvents.service.js";
import { queueNotificationEmail } from "../../services/email.service.js";

// Reusable SELECT with joins
const SELECT_HEARING_DETAILS = `
  SELECT 
    h.id,
    h.case_id,
    c.title AS case_title,
    c.status AS case_status,
    h.lawyer_user_id,
    (u.first_name || ' ' || u.last_name) AS lawyer_name,
    h.courtroom_id,
    cr.name AS courtroom_name,
    h.hearing_number,
    h.hearing_type,
    h.hearing_date::text AS hearing_date,
    h.start_time::text AS start_time,
    h.end_time::text AS end_time,
    h.status,
    h.created_by_registrar_id,
    h.created_at,
    h.updated_at
  FROM hearings h
  JOIN cases c ON c.id = h.case_id
  JOIN users u ON u.id = h.lawyer_user_id
  JOIN courtrooms cr ON cr.id = h.courtroom_id
`;

// Map database row to standard camelCase hearing structure
function mapHearing(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    caseTitle: row.case_title,
    caseStatus: row.case_status,
    lawyerUserId: row.lawyer_user_id,
    lawyerName: row.lawyer_name?.trim() || null,
    courtroomId: row.courtroom_id,
    courtroomName: row.courtroom_name,
    hearingNumber: row.hearing_number,
    hearingType: row.hearing_type,
    hearingDate: row.hearing_date,
    startTime: row.start_time?.substring(0, 5),
    endTime: row.end_time?.substring(0, 5),
    status: row.status,
    createdByRegistrarId: row.created_by_registrar_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Fetch case details with validation
async function getCaseDetails(caseId) {
  const result = await pool.query(
    `SELECT c.id, c.title, c.status, c.lawyer_user_id, c.client_user_id, c.assigned_tehsil, ct.category
     FROM cases c
     JOIN case_types ct ON ct.id = c.case_type_id
     WHERE c.id = $1`,
    [caseId]
  );
  if (result.rowCount === 0) {
    throw new ApiError(404, "Case not found");
  }
  return result.rows[0];
}

// Look up a user's email + first name so we can email them about a hearing.
async function getUserContact(userId) {
  if (!userId) return null;
  const r = await pool.query(
    "SELECT email, first_name FROM users WHERE id = $1",
    [userId]
  );
  return r.rows[0] || null;
}

// Email the lawyer and (if the case is linked to one) the client about a hearing
// event. Fire-and-forget + best-effort: a mail hiccup must never break the
// registrar's action, so failures are swallowed and logged. Mirrors the in-app
// notifications that fire alongside it.
async function emailHearingParties({
  lawyerUserId,
  clientUserId,
  category = "hearing",
  ...emailParams
}) {
  try {
    const recipientIds = [lawyerUserId, clientUserId].filter(Boolean);
    for (const userId of recipientIds) {
      const contact = await getUserContact(userId);
      if (!contact?.email) continue;
      // userId + category ride along so the email is skipped if this recipient
      // has muted that category (gate lives in queueNotificationEmail).
      queueNotificationEmail({
        email: contact.email,
        firstName: contact.first_name,
        userId,
        category,
        ...emailParams,
      });
    }
  } catch (err) {
    console.error("Failed to queue notification emails", err);
  }
}

// Fetch registrar tehsil to restrict scopes
async function getRegistrarTehsil(registrarUserId) {
  const result = await pool.query(
    `SELECT assigned_tehsil
     FROM registrar_profiles
     WHERE user_id = $1`,
    [registrarUserId]
  );
  const tehsil = result.rows[0]?.assigned_tehsil;
  if (!tehsil || !tehsil.trim()) {
    throw new ApiError(403, "No tehsil assigned to registrar account.");
  }
  return tehsil;
}

/**
 * Propose the first hearing slot right when a case is accepted.
 */
export async function proposeFirstHearing({ caseId, registrarUserId }) {
  const caseRow = await getCaseDetails(caseId);
  
  // Clean up any existing proposed hearings for safety
  await pool.query(
    "DELETE FROM hearings WHERE case_id = $1 AND status = 'proposed'",
    [caseId]
  );

  const hearingNumber = 1;
  const hearingType = getNextHearingStage(caseRow.category, 0);

  let success = false;
  let attempts = 0;
  let slot = null;
  const excludeSlots = [];

  while (attempts < 10 && !success) {
    slot = await findNextAvailableSlot({
      lawyerUserId: caseRow.lawyer_user_id,
      searchDays: 30,
      excludeSlots
    });

    if (!slot) {
      // Determine a fallback weekday
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + 1 + attempts);
      while (fallbackDate.getDay() === 0 || fallbackDate.getDay() === 6) {
        fallbackDate.setDate(fallbackDate.getDate() + 1);
      }
      
      const dateStr = fallbackDate.toISOString().split("T")[0];
      const courtroomsRes = await pool.query("SELECT id FROM courtrooms LIMIT 1");
      const fallbackCourtroomId = courtroomsRes.rows[0]?.id;

      if (!fallbackCourtroomId) {
        throw new Error("No courtrooms found in the database.");
      }

      slot = {
        date: dateStr,
        startTime: "09:00",
        endTime: "10:00",
        courtroomId: fallbackCourtroomId,
        isFallback: true
      };
    }

    try {
      await pool.query(
        `INSERT INTO hearings (
          case_id, lawyer_user_id, courtroom_id, hearing_number, hearing_type, 
          hearing_date, start_time, end_time, status, created_by_registrar_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'proposed', $9)`,
        [
          caseId,
          caseRow.lawyer_user_id,
          slot.courtroomId,
          hearingNumber,
          hearingType,
          slot.date,
          slot.startTime,
          slot.endTime,
          registrarUserId
        ]
      );
      
      if (slot.isFallback) {
        await pool.query(
          "UPDATE cases SET needs_manual_scheduling = true WHERE id = $1",
          [caseId]
        );

        try {
          await createNotification({
            userId: registrarUserId,
            type: "manual_scheduling_needed",
            title: "Manual Scheduling Required",
            message: `No conflict-free slot found for case "${caseRow.title}". Proposing fallback. Manual adjustment needed.`,
            caseId
          });
        } catch (err) {
          console.error("Failed to notify registrar of fallback", err);
        }
      }

      success = true;
    } catch (err) {
      if (err.code === "23505") { // unique_violation
        attempts++;
        if (slot && !slot.isFallback) {
          excludeSlots.push({
            courtroomId: slot.courtroomId,
            date: slot.date,
            startTime: slot.startTime
          });
        }
      } else {
        throw err;
      }
    }
  }

  if (!success) {
    throw new Error("Could not auto-propose hearing due to persistent unique constraint collisions.");
  }

  const hearingRes = await pool.query(
    "SELECT id FROM hearings WHERE case_id = $1 AND status = 'proposed'",
    [caseId]
  );
  return hearingRes.rows[0]?.id;
}

/**
 * Get proposed hearing slot or run the scheduler to return one dynamically.
 */
export async function getProposedHearingSlot({ caseId, registrarUserId }) {
  // Validate registrar tehsil match
  const tehsil = await getRegistrarTehsil(registrarUserId);
  const caseRow = await getCaseDetails(caseId);
  if (caseRow.assigned_tehsil.toLowerCase() !== tehsil.toLowerCase()) {
    throw new ApiError(403, "You do not have access to cases outside your tehsil.");
  }

  // Only accepted cases can have hearings scheduled
  if (caseRow.status !== 'accepted') {
    throw new ApiError(400, "Hearings can only be scheduled for accepted cases.");
  }

  // Check if proposed hearing exists
  const existingRes = await pool.query(
    `${SELECT_HEARING_DETAILS} WHERE h.case_id = $1 AND h.status = 'proposed'`,
    [caseId]
  );

  if (existingRes.rowCount > 0) {
    return mapHearing(existingRes.rows[0]);
  }

  // Dynamic proposal if none stored yet
  const countRes = await pool.query(
    "SELECT COUNT(*) as count FROM hearings WHERE case_id = $1 AND status IN ('scheduled', 'completed', 'adjourned')",
    [caseId]
  );
  const hearingCount = parseInt(countRes.rows[0].count, 10);
  const hearingNumber = hearingCount + 1;
  const hearingType = getNextHearingStage(caseRow.category, hearingCount);

  const slot = await findNextAvailableSlot({
    lawyerUserId: caseRow.lawyer_user_id,
    searchDays: 30
  });

  if (!slot) {
    return {
      needsManualScheduling: true,
      hearingNumber,
      hearingType,
      courtrooms: []
    };
  }

  const roomRes = await pool.query("SELECT name FROM courtrooms WHERE id = $1", [slot.courtroomId]);
  const roomName = roomRes.rows[0]?.name || "";

  return {
    needsManualScheduling: false,
    caseId,
    caseTitle: caseRow.title,
    lawyerUserId: caseRow.lawyer_user_id,
    courtroomId: slot.courtroomId,
    courtroomName: roomName,
    hearingNumber,
    hearingType,
    hearingDate: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    status: "proposed"
  };
}

/**
 * Confirm / adjust a proposed hearing slot.
 */
export async function confirmHearing({
  caseId,
  registrarUserId,
  date,
  startTime,
  courtroomId,
  hearingType
}) {
  const tehsil = await getRegistrarTehsil(registrarUserId);
  const caseRow = await getCaseDetails(caseId);
  
  if (caseRow.assigned_tehsil.toLowerCase() !== tehsil.toLowerCase()) {
    throw new ApiError(403, "You do not have access to cases outside your tehsil.");
  }

  // Only accepted cases can have hearings scheduled
  if (caseRow.status !== 'accepted') {
    throw new ApiError(400, "Hearings can only be scheduled for accepted cases.");
  }

  // Validate date is not in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hearingDate = new Date(date);
  if (hearingDate < today) {
    throw new ApiError(400, "Hearing date cannot be in the past.");
  }

  // Determine end time (1 hour duration)
  const SLOT_END_TIMES = {
    "09:00": "10:00",
    "10:00": "11:00",
    "11:00": "12:00",
    "12:00": "13:00",
    "14:00": "15:00",
    "15:00": "16:00"
  };
  const endTime = SLOT_END_TIMES[startTime] || "17:00";

  // Validate date is not a weekend
  const dObj = new Date(date);
  const day = dObj.getDay();
  if (day === 0 || day === 6) {
    throw new ApiError(400, "Cannot schedule hearings on weekends.");
  }

  // Validate not a holiday
  const holidayCheck = await pool.query(
    "SELECT id FROM holidays WHERE date = $1",
    [date]
  );
  if (holidayCheck.rowCount > 0) {
    throw new ApiError(400, "Cannot schedule hearings on a public holiday.");
  }

  // Check proposed hearing to either update or create
  const propRes = await pool.query(
    "SELECT id, hearing_number FROM hearings WHERE case_id = $1 AND status = 'proposed'",
    [caseId]
  );

  let hearingId;
  let hearingNumber;

  if (propRes.rowCount > 0) {
    hearingId = propRes.rows[0].id;
    hearingNumber = propRes.rows[0].hearing_number;
  } else {
    const countRes = await pool.query(
      "SELECT COUNT(*) as count FROM hearings WHERE case_id = $1 AND status IN ('scheduled', 'completed', 'adjourned')",
      [caseId]
    );
    hearingNumber = parseInt(countRes.rows[0].count, 10) + 1;
  }

  // Validate lawyer daily limit (max 5) on this date (excluding this hearing)
  const lawyerLimitCheck = await pool.query(
    `SELECT COUNT(*) as count FROM hearings 
     WHERE lawyer_user_id = $1 AND hearing_date = $2 
       AND status IN ('scheduled', 'completed', 'adjourned')
       AND id != $3`,
    [caseRow.lawyer_user_id, date, hearingId || '00000000-0000-0000-0000-000000000000']
  );
  if (parseInt(lawyerLimitCheck.rows[0].count, 10) >= 5) {
    throw new ApiError(400, "Lawyer has already reached the limit of 5 hearings on this date.");
  }

  // Validate lawyer time conflict (excluding this hearing)
  const lawyerSlotCheck = await pool.query(
    `SELECT id FROM hearings 
     WHERE lawyer_user_id = $1 AND hearing_date = $2 AND start_time = $3
       AND status IN ('scheduled', 'completed', 'adjourned')
       AND id != $4`,
    [caseRow.lawyer_user_id, date, startTime, hearingId || '00000000-0000-0000-0000-000000000000']
  );
  if (lawyerSlotCheck.rowCount > 0) {
    throw new ApiError(400, "Lawyer is already scheduled for another hearing at this time slot.");
  }

  // Validate courtroom conflict (excluding this hearing)
  const courtroomCheck = await pool.query(
    `SELECT id FROM hearings 
     WHERE courtroom_id = $1 AND hearing_date = $2 AND start_time = $3
       AND status IN ('scheduled', 'completed', 'adjourned')
       AND id != $4`,
    [courtroomId, date, startTime, hearingId || '00000000-0000-0000-0000-000000000000']
  );
  if (courtroomCheck.rowCount > 0) {
    throw new ApiError(400, "Courtroom is already booked for another case at this time slot.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (hearingId) {
      // Update proposed row to scheduled
      await client.query(
        `UPDATE hearings 
         SET courtroom_id = $1, hearing_date = $2, start_time = $3, end_time = $4,
             hearing_type = $5, status = 'scheduled', updated_at = NOW()
         WHERE id = $6`,
        [courtroomId, date, startTime, endTime, hearingType, hearingId]
      );
    } else {
      // Insert new scheduled row
      const insertRes = await client.query(
        `INSERT INTO hearings (
          case_id, lawyer_user_id, courtroom_id, hearing_number, hearing_type,
          hearing_date, start_time, end_time, status, created_by_registrar_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9)
        RETURNING id`,
        [caseId, caseRow.lawyer_user_id, courtroomId, hearingNumber, hearingType, date, startTime, endTime, registrarUserId]
      );
      hearingId = insertRes.rows[0].id;
    }

    // Clear needs_manual_scheduling on the case
    await client.query(
      "UPDATE cases SET needs_manual_scheduling = false WHERE id = $1",
      [caseId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const confirmedHearingRow = await pool.query(
    `${SELECT_HEARING_DETAILS} WHERE h.id = $1`,
    [hearingId]
  );
  const confirmed = mapHearing(confirmedHearingRow.rows[0]);

  // Record audit case event
  await safeRecordCaseEvent({
    caseId,
    eventType: "hearing_scheduled",
    actorUserId: registrarUserId,
    actorRole: "registrar",
    payload: {
      hearingId,
      hearingNumber,
      hearingType,
      hearingDate: date,
      startTime,
      courtroomName: confirmed.courtroomName
    }
  });

  // Notify lawyer and client
  const notifMsg = `Hearing #${hearingNumber} (${hearingType}) for case "${caseRow.title}" is scheduled on ${date} at ${startTime} in ${confirmed.courtroomName}.`;
  
  try {
    await createNotification({
      userId: caseRow.lawyer_user_id,
      type: "hearing_scheduled",
      title: "Hearing Scheduled",
      message: notifMsg,
      caseId
    });
  } catch (err) {
    console.error("Failed to notify lawyer of scheduled hearing", err);
  }

  if (caseRow.client_user_id) {
    try {
      await createNotification({
        userId: caseRow.client_user_id,
        type: "hearing_scheduled",
        title: "Hearing Scheduled",
        message: notifMsg,
        caseId
      });
    } catch (err) {
      console.error("Failed to notify client of scheduled hearing", err);
    }
  }

  // Email both parties — same moment as the in-app notifications above.
  await emailHearingParties({
    lawyerUserId: caseRow.lawyer_user_id,
    clientUserId: caseRow.client_user_id,
    subject: `Hearing scheduled — ${confirmed.hearingType}`,
    heading: "Hearing Scheduled",
    intro: `A hearing has been scheduled for your case "${caseRow.title}". Please attend in person at the court on the date below.`,
    caseTitle: caseRow.title,
    hearingLine: `Hearing #${hearingNumber} — ${confirmed.hearingType}`,
    showSchedule: true,
    date: confirmed.hearingDate,
    timeLabel: `${confirmed.startTime} – ${confirmed.endTime}`,
    courtroomName: confirmed.courtroomName,
    footerNote:
      "Hearings are held in person at the court. Please arrive on time with all required documents.",
  });

  return confirmed;
}

/**
 * Record a hearing's outcome and schedule the next hearing if appropriate.
 */
export async function recordOutcome({
  hearingId,
  registrarUserId,
  outcome,
  remarks,
  nextHearingType
}) {
  const tehsil = await getRegistrarTehsil(registrarUserId);

  const hearingRes = await pool.query(
    `${SELECT_HEARING_DETAILS} WHERE h.id = $1`,
    [hearingId]
  );
  if (hearingRes.rowCount === 0) {
    throw new ApiError(404, "Hearing not found.");
  }
  const hearing = mapHearing(hearingRes.rows[0]);

  const caseRow = await getCaseDetails(hearing.caseId);
  if (caseRow.assigned_tehsil.toLowerCase() !== tehsil.toLowerCase()) {
    throw new ApiError(403, "You do not have access to cases outside your tehsil.");
  }

  if (hearing.status !== "scheduled") {
    throw new ApiError(400, "Can only record outcome for scheduled hearings.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Insert hearing outcome
    await client.query(
      `INSERT INTO hearing_outcomes (
        hearing_id, outcome, remarks, next_hearing_type, recorded_by_registrar_id
      ) VALUES ($1, $2, $3, $4, $5)`,
      [hearingId, outcome, remarks, nextHearingType, registrarUserId]
    );

    // Update hearing status
    const dbStatus = outcome === "adjourned" ? "adjourned" : "completed";
    await client.query(
      "UPDATE hearings SET status = $1, updated_at = NOW() WHERE id = $2",
      [dbStatus, hearingId]
    );

    if (outcome === "disposed") {
      // Transition case to disposed status
      await client.query(
        "UPDATE cases SET status = 'disposed', updated_at = NOW() WHERE id = $1",
        [hearing.caseId]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Record audit case event
  await safeRecordCaseEvent({
    caseId: hearing.caseId,
    eventType: "hearing_completed",
    actorUserId: registrarUserId,
    actorRole: "registrar",
    payload: {
      hearingId,
      hearingNumber: hearing.hearingNumber,
      outcome,
      remarks
    }
  });

  if (outcome === "disposed") {
    await safeRecordCaseEvent({
      caseId: hearing.caseId,
      eventType: "case_disposed",
      actorUserId: registrarUserId,
      actorRole: "registrar",
      payload: {
        hearingId,
        remarks
      }
    });

    // Notify lawyer and client of case disposal with full verdict context
    const disposeMsg = `Case "${caseRow.title}" has been officially disposed of (closed). The court's final decision has been recorded${remarks ? `: ${remarks}` : '.'}. No further hearings will be scheduled for this case.`;
    const notifyRecipients = [caseRow.lawyer_user_id, caseRow.client_user_id].filter(Boolean);
    for (const userId of notifyRecipients) {
      try {
        await createNotification({
          userId,
          type: "case_disposed",
          title: "Case Closed – Final Decision",
          message: disposeMsg,
          caseId: hearing.caseId
        });
      } catch (err) {
        console.error("Failed to notify user of case disposal", err);
      }
    }

    await emailHearingParties({
      lawyerUserId: caseRow.lawyer_user_id,
      clientUserId: caseRow.client_user_id,
      // Disposal is a CASE event — gated by the "case" preference, not "hearing".
      category: "case",
      subject: `Case closed — ${caseRow.title}`,
      heading: "Case Closed — Final Decision",
      intro: `Your case "${caseRow.title}" has been disposed (officially closed) by the court. The final decision has been recorded.`,
      caseTitle: caseRow.title,
      detailLabel: "Final stage",
      detailValue: hearing.hearingType,
      showSchedule: false,
      showRemarks: Boolean(remarks),
      remarksLabel: "Court's final decision / remarks",
      remarks,
      footerNote: "No further hearings will be scheduled for this case.",
    });
  } else {
    // Notify lawyer and client of the hearing outcome (completed / adjourned)
    const outcomeLabel = outcome === "adjourned" ? "Adjourned" : "Completed";
    const outcomeMsg = outcome === "adjourned"
      ? `Hearing #${hearing.hearingNumber} (${hearing.hearingType}) for case "${caseRow.title}" has been adjourned${nextHearingType ? ` — next stage: ${nextHearingType}` : ''}. Reason: ${remarks || 'Not specified'}. A new hearing will be proposed shortly.`
      : `Hearing #${hearing.hearingNumber} (${hearing.hearingType}) for case "${caseRow.title}" has been completed. Court order/remarks: ${remarks || 'None'}. The next hearing stage will be proposed shortly.`;

    const outcomeRecipients = [caseRow.lawyer_user_id, caseRow.client_user_id].filter(Boolean);
    for (const userId of outcomeRecipients) {
      try {
        await createNotification({
          userId,
          type: outcome === "adjourned" ? "hearing_adjourned" : "hearing_completed",
          title: `Hearing ${outcomeLabel}: ${hearing.hearingType}`,
          message: outcomeMsg,
          caseId: hearing.caseId
        });
      } catch (err) {
        console.error(`Failed to notify user of hearing ${outcome}`, err);
      }
    }

    const isAdjourned = outcome === "adjourned";
    await emailHearingParties({
      lawyerUserId: caseRow.lawyer_user_id,
      clientUserId: caseRow.client_user_id,
      subject: `Hearing ${isAdjourned ? "adjourned" : "completed"} — ${hearing.hearingType}`,
      heading: isAdjourned ? "Hearing Adjourned" : "Hearing Completed",
      intro: isAdjourned
        ? `Hearing #${hearing.hearingNumber} (${hearing.hearingType}) for your case "${caseRow.title}" was adjourned. A new hearing will be scheduled and you'll be notified of the date.`
        : `Hearing #${hearing.hearingNumber} (${hearing.hearingType}) for your case "${caseRow.title}" was completed. The next hearing will be scheduled and you'll be notified of the date.`,
      caseTitle: caseRow.title,
      hearingLine: `Hearing #${hearing.hearingNumber} — ${hearing.hearingType}`,
      showSchedule: false,
      showRemarks: Boolean(remarks),
      remarksLabel: isAdjourned ? "Reason for adjournment" : "Court order / remarks",
      remarks,
      footerNote:
        isAdjourned && nextHearingType
          ? `Next stage: ${nextHearingType}. You'll receive the new hearing date once it's scheduled.`
          : "You'll receive the next hearing's date once it's scheduled.",
    });

    // Schedule next hearing (Completed / Adjourned)
    // We await this synchronously so the frontend's subsequent GET /hearings
    // immediately sees the newly proposed hearing without needing a manual refresh.
    try {
      // If adjourned and nextHearingType was specified, use that as next type
      const nextType = outcome === "adjourned" && nextHearingType 
        ? nextHearingType 
        : null;

      await proposeNextHearing({
        caseId: hearing.caseId,
        registrarUserId,
        forcedHearingType: nextType
      });
    } catch (err) {
      console.error("Failed to auto-propose next hearing after outcome", err);
    }
  }

  return { hearingId, outcome, status: outcome === "adjourned" ? "adjourned" : "completed" };
}

/**
 * Propose the next hearing slot.
 */
async function proposeNextHearing({ caseId, registrarUserId, forcedHearingType = null }) {
  const caseRow = await getCaseDetails(caseId);

  // Remove any stale proposed hearings
  await pool.query(
    "DELETE FROM hearings WHERE case_id = $1 AND status = 'proposed'",
    [caseId]
  );

  const countRes = await pool.query(
    "SELECT COUNT(*) as count FROM hearings WHERE case_id = $1 AND status IN ('scheduled', 'completed', 'adjourned')",
    [caseId]
  );
  const hearingCount = parseInt(countRes.rows[0].count, 10);
  const hearingNumber = hearingCount + 1;

  const hearingType = forcedHearingType || getNextHearingStage(caseRow.category, hearingCount);

  let success = false;
  let attempts = 0;
  let slot = null;
  const excludeSlots = [];

  while (attempts < 10 && !success) {
    slot = await findNextAvailableSlot({
      lawyerUserId: caseRow.lawyer_user_id,
      searchDays: 30,
      excludeSlots
    });

    if (!slot) {
      const TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00"];
      const SLOT_END_TIMES = {
        "09:00": "10:00",
        "10:00": "11:00",
        "11:00": "12:00",
        "12:00": "13:00",
        "14:00": "15:00",
        "15:00": "16:00"
      };

      const dayOffset = 1 + Math.floor(attempts / TIME_SLOTS.length);
      const slotIndex = attempts % TIME_SLOTS.length;
      
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + dayOffset);
      while (fallbackDate.getDay() === 0 || fallbackDate.getDay() === 6) {
        fallbackDate.setDate(fallbackDate.getDate() + 1);
      }
      
      const dateStr = fallbackDate.toISOString().split("T")[0];
      const courtroomsRes = await pool.query("SELECT id FROM courtrooms LIMIT 1");
      const fallbackCourtroomId = courtroomsRes.rows[0]?.id;

      if (!fallbackCourtroomId) {
        throw new Error("No courtrooms found in the database.");
      }

      const startTime = TIME_SLOTS[slotIndex];
      slot = {
        date: dateStr,
        startTime: startTime,
        endTime: SLOT_END_TIMES[startTime],
        courtroomId: fallbackCourtroomId,
        isFallback: true
      };
    }

    try {
      await pool.query(
        `INSERT INTO hearings (
          case_id, lawyer_user_id, courtroom_id, hearing_number, hearing_type, 
          hearing_date, start_time, end_time, status, created_by_registrar_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'proposed', $9)`,
        [
          caseId,
          caseRow.lawyer_user_id,
          slot.courtroomId,
          hearingNumber,
          hearingType,
          slot.date,
          slot.startTime,
          slot.endTime,
          registrarUserId
        ]
      );

      if (slot.isFallback) {
        await pool.query(
          "UPDATE cases SET needs_manual_scheduling = true WHERE id = $1",
          [caseId]
        );

        try {
          await createNotification({
            userId: registrarUserId,
            type: "manual_scheduling_needed",
            title: "Manual Scheduling Required",
            message: `No conflict-free slot found for next hearing of case "${caseRow.title}". Proposing fallback.`,
            caseId
          });
        } catch (err) {
          console.error("Failed to notify registrar of fallback", err);
        }
      }

      success = true;
    } catch (err) {
      if (err.code === "23505") { // unique_violation
        attempts++;
        if (slot && !slot.isFallback) {
          excludeSlots.push({
            courtroomId: slot.courtroomId,
            date: slot.date,
            startTime: slot.startTime
          });
        }
      } else {
        throw err;
      }
    }
  }

  if (!success) {
    throw new Error("Could not auto-propose next hearing due to persistent collisions.");
  }
}

/**
 * Reschedule a scheduled hearing.
 */
export async function rescheduleHearing({
  hearingId,
  registrarUserId,
  newDate,
  newStartTime,
  newCourtroomId
}) {
  const tehsil = await getRegistrarTehsil(registrarUserId);

  const hearingRes = await pool.query(
    `${SELECT_HEARING_DETAILS} WHERE h.id = $1`,
    [hearingId]
  );
  if (hearingRes.rowCount === 0) {
    throw new ApiError(404, "Hearing not found.");
  }
  const hearing = mapHearing(hearingRes.rows[0]);

  const caseRow = await getCaseDetails(hearing.caseId);
  if (caseRow.assigned_tehsil.toLowerCase() !== tehsil.toLowerCase()) {
    throw new ApiError(403, "You do not have access to cases outside your tehsil.");
  }

  if (hearing.status !== "scheduled" && hearing.status !== "proposed") {
    throw new ApiError(400, "Can only reschedule scheduled or proposed hearings.");
  }

  // Validate date is not in the past
  const todayR = new Date();
  todayR.setHours(0, 0, 0, 0);
  const newHearingDate = new Date(newDate);
  if (newHearingDate < todayR) {
    throw new ApiError(400, "Hearing date cannot be in the past.");
  }

  // Calculate end time
  const SLOT_END_TIMES = {
    "09:00": "10:00",
    "10:00": "11:00",
    "11:00": "12:00",
    "12:00": "13:00",
    "14:00": "15:00",
    "15:00": "16:00"
  };
  const newEndTime = SLOT_END_TIMES[newStartTime] || "17:00";

  // Validate date is not weekend
  const dObj = new Date(newDate);
  const day = dObj.getDay();
  if (day === 0 || day === 6) {
    throw new ApiError(400, "Cannot reschedule to a weekend.");
  }

  // Validate date is not holiday
  const holidayCheck = await pool.query("SELECT id FROM holidays WHERE date = $1", [newDate]);
  if (holidayCheck.rowCount > 0) {
    throw new ApiError(400, "Cannot reschedule to a public holiday.");
  }

  // Validate lawyer daily limit (max 5) on this date (excluding this hearing)
  const lawyerLimitCheck = await pool.query(
    `SELECT COUNT(*) as count FROM hearings 
     WHERE lawyer_user_id = $1 AND hearing_date = $2 
       AND status IN ('scheduled', 'completed', 'adjourned')
       AND id != $3`,
    [hearing.lawyerUserId, newDate, hearingId]
  );
  if (parseInt(lawyerLimitCheck.rows[0].count, 10) >= 5) {
    throw new ApiError(400, "Lawyer has already reached the limit of 5 hearings on this date.");
  }

  // Validate lawyer slot conflict (excluding this hearing)
  const lawyerSlotCheck = await pool.query(
    `SELECT id FROM hearings 
     WHERE lawyer_user_id = $1 AND hearing_date = $2 AND start_time = $3
       AND status IN ('scheduled', 'completed', 'adjourned')
       AND id != $4`,
    [hearing.lawyerUserId, newDate, newStartTime, hearingId]
  );
  if (lawyerSlotCheck.rowCount > 0) {
    throw new ApiError(400, "Lawyer is already scheduled for another hearing at this time slot.");
  }

  // Validate courtroom conflict (excluding this hearing)
  const courtroomCheck = await pool.query(
    `SELECT id FROM hearings 
     WHERE courtroom_id = $1 AND hearing_date = $2 AND start_time = $3
       AND status IN ('scheduled', 'completed', 'adjourned')
       AND id != $4`,
    [newCourtroomId, newDate, newStartTime, hearingId]
  );
  if (courtroomCheck.rowCount > 0) {
    throw new ApiError(400, "Courtroom is already booked for another case at this time slot.");
  }

  // Apply Update
  await pool.query(
    `UPDATE hearings 
     SET courtroom_id = $1, hearing_date = $2, start_time = $3, end_time = $4,
         status = 'scheduled', updated_at = NOW()
     WHERE id = $5`,
    [newCourtroomId, newDate, newStartTime, newEndTime, hearingId]
  );

  const updatedHearingRow = await pool.query(
    `${SELECT_HEARING_DETAILS} WHERE h.id = $1`,
    [hearingId]
  );
  const updatedHearing = mapHearing(updatedHearingRow.rows[0]);

  // Clear case flag if it was set
  await pool.query("UPDATE cases SET needs_manual_scheduling = false WHERE id = $1", [hearing.caseId]);

  // Notify lawyer and client (only if it was scheduled previously)
  if (hearing.status === "scheduled") {
    const rescheduleMsg = `Hearing #${hearing.hearingNumber} for case "${caseRow.title}" has been rescheduled to ${newDate} at ${newStartTime} in ${updatedHearing.courtroomName}.`;
    
    try {
      await createNotification({
        userId: hearing.lawyerUserId,
        type: "hearing_rescheduled",
        title: "Hearing Rescheduled",
        message: rescheduleMsg,
        caseId: hearing.caseId
      });
    } catch (err) {
      console.error("Failed to notify lawyer of rescheduled hearing", err);
    }

    if (caseRow.client_user_id) {
      try {
        await createNotification({
          userId: caseRow.client_user_id,
          type: "hearing_rescheduled",
          title: "Hearing Rescheduled",
          message: rescheduleMsg,
          caseId: hearing.caseId
        });
      } catch (err) {
        console.error("Failed to notify client of rescheduled hearing", err);
      }
    }

    await emailHearingParties({
      lawyerUserId: hearing.lawyerUserId,
      clientUserId: caseRow.client_user_id,
      subject: `Hearing rescheduled — ${updatedHearing.hearingType}`,
      heading: "Hearing Rescheduled",
      intro: `Hearing #${hearing.hearingNumber} (${updatedHearing.hearingType}) for your case "${caseRow.title}" has been moved to a new date. Please note the updated details below.`,
      caseTitle: caseRow.title,
      hearingLine: `Hearing #${hearing.hearingNumber} — ${updatedHearing.hearingType}`,
      showSchedule: true,
      date: updatedHearing.hearingDate,
      timeLabel: `${updatedHearing.startTime} – ${updatedHearing.endTime}`,
      courtroomName: updatedHearing.courtroomName,
      footerNote:
        "Please attend in person at the court on the new date. Your earlier date no longer applies.",
    });
  }

  return updatedHearing;
}

/**
 * Cancel a hearing.
 */
export async function cancelHearing({ hearingId, registrarUserId }) {
  const tehsil = await getRegistrarTehsil(registrarUserId);

  const hearingRes = await pool.query(
    `${SELECT_HEARING_DETAILS} WHERE h.id = $1`,
    [hearingId]
  );
  if (hearingRes.rowCount === 0) {
    throw new ApiError(404, "Hearing not found.");
  }
  const hearing = mapHearing(hearingRes.rows[0]);

  const caseRow = await getCaseDetails(hearing.caseId);
  if (caseRow.assigned_tehsil.toLowerCase() !== tehsil.toLowerCase()) {
    throw new ApiError(403, "You do not have access to cases outside your tehsil.");
  }

  if (hearing.status !== "scheduled" && hearing.status !== "proposed") {
    throw new ApiError(400, "Can only cancel scheduled or proposed hearings.");
  }

  await pool.query(
    "UPDATE hearings SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
    [hearingId]
  );

  // Notify lawyer and client
  if (hearing.status === "scheduled") {
    const cancelMsg = `Hearing #${hearing.hearingNumber} for case "${caseRow.title}" has been cancelled.`;
    
    try {
      await createNotification({
        userId: hearing.lawyerUserId,
        type: "hearing_cancelled",
        title: "Hearing Cancelled",
        message: cancelMsg,
        caseId: hearing.caseId
      });
    } catch (err) {
      console.error("Failed to notify lawyer of cancelled hearing", err);
    }

    if (caseRow.client_user_id) {
      try {
        await createNotification({
          userId: caseRow.client_user_id,
          type: "hearing_cancelled",
          title: "Hearing Cancelled",
          message: cancelMsg,
          caseId: hearing.caseId
        });
      } catch (err) {
        console.error("Failed to notify client of cancelled hearing", err);
      }
    }

    await emailHearingParties({
      lawyerUserId: hearing.lawyerUserId,
      clientUserId: caseRow.client_user_id,
      subject: `Hearing cancelled — ${hearing.hearingType}`,
      heading: "Hearing Cancelled",
      intro: `Hearing #${hearing.hearingNumber} (${hearing.hearingType}) for your case "${caseRow.title}" has been cancelled. The previously scheduled slot below no longer applies.`,
      caseTitle: caseRow.title,
      hearingLine: `Hearing #${hearing.hearingNumber} — ${hearing.hearingType}`,
      showSchedule: true,
      date: hearing.hearingDate,
      timeLabel: `${hearing.startTime} – ${hearing.endTime}`,
      courtroomName: hearing.courtroomName,
      footerNote: "If a new hearing is scheduled, you'll be notified by email.",
    });
  }

  return { hearingId, status: "cancelled" };
}

/**
 * List hearings for a specific case (visible to registrar, lawyer, client).
 */
export async function listCaseHearings({ caseId, userId, userRole }) {
  // Access control
  const caseRow = await getCaseDetails(caseId);

  if (userRole === "registrar") {
    const tehsil = await getRegistrarTehsil(userId);
    if (caseRow.assigned_tehsil.toLowerCase() !== tehsil.toLowerCase()) {
      throw new ApiError(403, "You do not have access to cases outside your tehsil.");
    }
  } else if (userRole === "lawyer") {
    if (caseRow.lawyer_user_id !== userId) {
      throw new ApiError(403, "You do not have access to this case.");
    }
  } else if (userRole === "client") {
    if (caseRow.client_user_id !== userId) {
      throw new ApiError(403, "You do not have access to this case.");
    }
  } else {
    throw new ApiError(403, "Unauthorized role.");
  }

  const result = await pool.query(
    `${SELECT_HEARING_DETAILS} 
     WHERE h.case_id = $1 
     ORDER BY h.hearing_number ASC, h.hearing_date ASC`,
    [caseId]
  );

  return result.rows.map(mapHearing);
}

/**
 * List hearings across all cases for a lawyer.
 * Includes proposed hearings so the lawyer sees pending court dates.
 * Priority order: scheduled first, then proposed, then adjourned, completed, cancelled.
 */
export async function listLawyerHearings({ lawyerUserId }) {
  const result = await pool.query(
    `${SELECT_HEARING_DETAILS} 
     WHERE h.lawyer_user_id = $1 AND h.status IN ('proposed', 'scheduled', 'completed', 'adjourned', 'cancelled')
     ORDER BY
       CASE h.status
         WHEN 'scheduled' THEN 1
         WHEN 'proposed'  THEN 2
         WHEN 'adjourned' THEN 3
         WHEN 'completed' THEN 4
         WHEN 'cancelled' THEN 5
         ELSE 6
       END ASC,
       h.hearing_date ASC,
       h.start_time ASC`,
    [lawyerUserId]
  );
  return result.rows.map(mapHearing);
}

/**
 * List hearings across all cases for a client.
 * Includes proposed hearings so the client sees pending court dates.
 * Priority order: scheduled first, then proposed, then adjourned, completed, cancelled.
 */
export async function listClientHearings({ clientUserId }) {
  const result = await pool.query(
    `${SELECT_HEARING_DETAILS} 
     WHERE c.client_user_id = $1 AND h.status IN ('proposed', 'scheduled', 'completed', 'adjourned', 'cancelled')
     ORDER BY
       CASE h.status
         WHEN 'scheduled' THEN 1
         WHEN 'proposed'  THEN 2
         WHEN 'adjourned' THEN 3
         WHEN 'completed' THEN 4
         WHEN 'cancelled' THEN 5
         ELSE 6
       END ASC,
       h.hearing_date ASC,
       h.start_time ASC`,
    [clientUserId]
  );
  return result.rows.map(mapHearing);
}

/**
 * List hearings across all cases for a registrar in their tehsil.
 */
export async function listRegistrarHearings({ registrarUserId, status }) {
  const tehsil = await getRegistrarTehsil(registrarUserId);

  let statusFilter = "AND h.status IN ('proposed', 'scheduled', 'completed', 'adjourned', 'cancelled')";
  if (status) {
    statusFilter = "AND h.status = $2";
  }

  const queryParams = [tehsil];
  if (status) queryParams.push(status);

  const result = await pool.query(
    `${SELECT_HEARING_DETAILS} 
     WHERE LOWER(c.assigned_tehsil) = LOWER($1) ${statusFilter}
     ORDER BY h.hearing_date DESC, h.start_time DESC`,
    queryParams
  );

  return result.rows.map(mapHearing);
}

/**
 * List active courtrooms (Registrar).
 */
export async function listActiveCourtrooms() {
  const result = await pool.query(
    "SELECT id, name FROM courtrooms WHERE is_active = true ORDER BY name"
  );
  return result.rows.map(r => ({ id: r.id, name: r.name }));
}

/**
 * List holidays (Registrar).
 */
export async function listHolidays() {
  const result = await pool.query(
    "SELECT id, date::text as date, reason FROM holidays ORDER BY date ASC"
  );
  return result.rows.map(r => ({ id: r.id, date: r.date, reason: r.reason }));
}

/**
 * Add a holiday (Registrar).
 */
export async function addHoliday({ date, reason }) {
  const result = await pool.query(
    "INSERT INTO holidays (date, reason) VALUES ($1, $2) RETURNING id, date::text as date, reason",
    [date, reason]
  );
  return result.rows[0];
}

/**
 * Delete a holiday (Registrar).
 */
export async function deleteHoliday({ id }) {
  const result = await pool.query(
    "DELETE FROM holidays WHERE id = $1 RETURNING id",
    [id]
  );
  if (result.rowCount === 0) {
    throw new ApiError(404, "Holiday not found.");
  }
  return { id };
}
