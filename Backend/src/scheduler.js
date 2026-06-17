import { sendOverdueReminders } from "./modules/payments/overdueReminders.service.js";

// LawFlow's lightweight in-process scheduler. No external cron dependency: a
// timer runs the overdue-reminder sweep shortly after startup and then on a
// fixed interval. The sweep itself is idempotent within its cadence window
// (it stamps each installment), so frequent restarts never spam recipients.

const STARTUP_DELAY_MS = 15 * 1000; // let the server settle before the first run
const INTERVAL_MS = 12 * 60 * 60 * 1000; // every 12 hours

async function runOverdueSweep() {
  try {
    const summary = await sendOverdueReminders();
    if (summary.remindersSent > 0) {
      console.log(
        `[scheduler] overdue reminders: ${summary.remindersSent} sent (${summary.checked} due for reminder)`
      );
    }
  } catch (error) {
    console.error(
      "[scheduler] overdue reminder sweep failed:",
      error?.message || error
    );
  }
}

export function startScheduledJobs() {
  // Disable in test runs or by env flag if ever needed.
  if (process.env.DISABLE_SCHEDULER === "true") {
    console.log("[scheduler] disabled via DISABLE_SCHEDULER");
    return;
  }

  const startupTimer = setTimeout(runOverdueSweep, STARTUP_DELAY_MS);
  const intervalTimer = setInterval(runOverdueSweep, INTERVAL_MS);
  // Don't let these timers keep the process alive on their own.
  startupTimer.unref?.();
  intervalTimer.unref?.();
}
