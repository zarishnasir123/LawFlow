import "dotenv/config";

import app from "./app.js";
import { pool } from "./config/db.js";
import { warmEmailTransport } from "./services/email.service.js";
import { startScheduledJobs } from "./scheduler.js";
import { initChatSocket } from "./realtime/chatSocket.js";

const port = process.env.PORT || 5000;

async function startServer() {
  await pool.query("SELECT 1");
  await warmEmailTransport();

  const server = app.listen(port, () => {
    console.log(`LawFlow backend running on port ${port}`);

    // Background jobs (overdue payment reminders, etc.).
    startScheduledJobs();

    // Enable this temporarily when debugging SMTP setup.
    // const emailConfig = getEmailDeliveryConfig();
    // if (emailConfig.mode === "smtp") {
    //   console.log("Email delivery mode: SMTP. OTP emails will be sent to user inboxes.");
    // } else {
    //   console.warn(
    //     `Email delivery mode: console only. OTP emails will NOT reach inboxes. Missing: ${emailConfig.issues.join(", ")}`
    //   );
    // }
  });

  // Attach the chat WebSocket server to the same HTTP server (path /ws/chat).
  initChatSocket(server);
}

startServer().catch((error) => {
  console.error("Failed to start backend server:", error);
  process.exit(1);
});
