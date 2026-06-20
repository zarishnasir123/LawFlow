import { pool } from "../../config/db.js";

export const CIVIL_STAGES = [
  'First Appearance / Summons',
  'Written Statement',
  'Framing of Issues',
  'Evidence (Plaintiff)',
  'Evidence (Defendant)',
  'Final Arguments',
  'Judgment / Order'
];

export const FAMILY_STAGES = [
  'First Appearance / Summons',
  'Written Statement',
  'Pre-Trial Reconciliation',
  'Framing of Issues',
  'Evidence',
  'Post-Trial Reconciliation',
  'Final Arguments / Judgment'
];

// Helper to check if a date is a weekend (Saturday or Sunday)
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

// Format date as YYYY-MM-DD
function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Normalize time strings to HH:MM (e.g. "09:00:00" -> "09:00")
function normalizeTime(t) {
  if (!t) return "";
  return t.substring(0, 5);
}

/**
 * Finds the next available hearing slot.
 * @param {string} lawyerUserId 
 * @param {number} searchDays Initial search window (e.g., 30)
 * @param {Array<{courtroomId: string, date: string, startTime: string}>} excludeSlots Slots to explicitly avoid
 * @returns {Promise<{ date: string, startTime: string, endTime: string, courtroomId: string }|null>}
 */
export async function findNextAvailableSlot({ lawyerUserId, searchDays = 30, excludeSlots = [] }) {
  // 1. Fetch active courtrooms
  const courtroomRes = await pool.query(
    "SELECT id, name FROM courtrooms WHERE is_active = true ORDER BY name"
  );
  if (courtroomRes.rowCount === 0) {
    return null; // No courtrooms available to schedule
  }
  const courtrooms = courtroomRes.rows;

  // 2. Fetch holidays
  const holidayRes = await pool.query(
    "SELECT date::text FROM holidays WHERE date >= CURRENT_DATE"
  );
  const holidaySet = new Set(holidayRes.rows.map(r => r.date));

  // 3. Fetch lawyer's existing bookings
  const lawyerBookingsRes = await pool.query(
    `SELECT hearing_date::text as date, start_time::text as start_time 
     FROM hearings 
     WHERE lawyer_user_id = $1 
       AND status IN ('proposed', 'scheduled') 
       AND hearing_date >= CURRENT_DATE`,
    [lawyerUserId]
  );
  
  // Group lawyer bookings by date
  const lawyerBookingsByDate = {};
  for (const booking of lawyerBookingsRes.rows) {
    const d = booking.date;
    const t = normalizeTime(booking.start_time);
    if (!lawyerBookingsByDate[d]) {
      lawyerBookingsByDate[d] = [];
    }
    lawyerBookingsByDate[d].push(t);
  }

  // 4. Fetch courtroom bookings
  const courtroomBookingsRes = await pool.query(
    `SELECT courtroom_id, hearing_date::text as date, start_time::text as start_time 
     FROM hearings 
     WHERE status IN ('proposed', 'scheduled') 
       AND hearing_date >= CURRENT_DATE`
  );
  
  // Structure courtroom bookings: { [date]: { [courtroomId]: Set of times } }
  const courtroomBookings = {};
  for (const booking of courtroomBookingsRes.rows) {
    const d = booking.date;
    const room = booking.courtroom_id;
    const t = normalizeTime(booking.start_time);
    if (!courtroomBookings[d]) {
      courtroomBookings[d] = {};
    }
    if (!courtroomBookings[d][room]) {
      courtroomBookings[d][room] = new Set();
    }
    courtroomBookings[d][room].add(t);
  }

  // Permitted hour-long slot starts (13:00-14:00 is lunch)
  const TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00"];
  const SLOT_END_TIMES = {
    "09:00": "10:00",
    "10:00": "11:00",
    "11:00": "12:00",
    "12:00": "13:00",
    "14:00": "15:00",
    "15:00": "16:00"
  };

  // Helper function to search within a range of days starting tomorrow
  const runSearch = (maxDays) => {
    let currentDate = new Date();
    // Start search from tomorrow
    currentDate.setDate(currentDate.getDate() + 1);

    for (let dayOffset = 1; dayOffset <= maxDays; dayOffset++) {
      const dateStr = formatDate(currentDate);

      // Check if weekend or holiday
      if (!isWeekend(currentDate) && !holidaySet.has(dateStr)) {
        const lawyerTodaySlots = lawyerBookingsByDate[dateStr] || [];

        // Concurrency Rule 1: Max 5 hearings per day for lawyer
        if (lawyerTodaySlots.length < 5) {
          // Loop over slots
          for (const slotStart of TIME_SLOTS) {
            // Concurrency Rule 2: Lawyer must not be booked in this slot already
            if (!lawyerTodaySlots.includes(slotStart)) {
              
              // Concurrency Rule 3: Find courtroom that is not booked
              for (const room of courtrooms) {
                const roomTodayBooked = courtroomBookings[dateStr]?.[room.id];
                if (!roomTodayBooked || !roomTodayBooked.has(slotStart)) {
                  
                  // Rule 4: Ensure it's not in the exclude list (failed attempts)
                  const isExcluded = excludeSlots.some(ex => 
                    ex.courtroomId === room.id && 
                    ex.date === dateStr && 
                    ex.startTime === slotStart
                  );
                  
                  if (!isExcluded) {
                    // Found slot!
                    return {
                      date: dateStr,
                      startTime: slotStart,
                      endTime: SLOT_END_TIMES[slotStart],
                      courtroomId: room.id
                    };
                  }
                }
              }

            }
          }
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return null;
  };

  // Try initial search window (e.g. 30 days)
  let foundSlot = runSearch(searchDays);
  if (foundSlot) return foundSlot;

  // Widen to 60 days
  foundSlot = runSearch(60);
  if (foundSlot) return foundSlot;

  return null;
}

/**
 * Returns the stage label based on case type and existing hearing count.
 * @param {string} category 'civil' or 'family'
 * @param {number} hearingIndex 0-based index
 * @returns {string}
 */
export function getNextHearingStage(category, hearingIndex) {
  const normalizedCategory = String(category || '').toLowerCase().trim();
  const stages = normalizedCategory === "family" ? FAMILY_STAGES : CIVIL_STAGES;
  if (hearingIndex >= stages.length) {
    return "Interim / Miscellaneous";
  }
  return stages[hearingIndex];
}
