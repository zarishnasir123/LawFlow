import "dotenv/config";

import app from "./app.js";
import { pool } from "./config/db.js";
// import { getEmailDeliveryConfig } from "./services/email.service.js";

const port = process.env.PORT || 5000;

async function startServer() {
  await pool.query("SELECT 1");

  app.listen(port, () => {
    console.log(`LawFlow backend running on port ${port}`);

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
}

startServer().catch((error) => {
  console.error("Failed to start backend server:", error);
  process.exit(1);
});
