// Manually run the overdue-installment reminder sweep (emails + in-app
// notifications to client AND lawyer). Useful for demos so you don't have to
// wait for the scheduler.
//
//   node --env-file=.env src/scripts/sendOverdueReminders.js
//   node --env-file=.env src/scripts/sendOverdueReminders.js --cadence=0   # ignore the spacing guard (force re-send)
import "dotenv/config";
import { pool } from "../config/db.js";
import { sendOverdueReminders } from "../modules/payments/overdueReminders.service.js";

const cadenceArg = process.argv.find((a) => a.startsWith("--cadence="));
const cadenceDays = cadenceArg ? Number(cadenceArg.split("=")[1]) : 3;

const summary = await sendOverdueReminders({ cadenceDays });
console.log("Overdue reminder sweep complete:", summary);

// Emails are queued asynchronously; give them a moment to flush before exit.
await new Promise((resolve) => setTimeout(resolve, 6000));
await pool.end();
process.exit(0);
