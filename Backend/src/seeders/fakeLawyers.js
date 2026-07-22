// Local-dev helper: populate the lawyer directory with fake but
// realistic-looking lawyers so the client's Find-a-Lawyer page has
// something to render without 20 manual sign-ups + admin approvals.
//
// Lives under Backend/src/seeders/ — kept separate from
// Backend/src/scripts/ so operational utilities (seedAdmin,
// deleteUser, syncSupabaseUsers, etc.) stay distinct from
// throwaway demo-data generators.
//
// Every seeded row gets a recognizable marker on its bar license
// number ("FAKE-<uuid>") so the --clear flag can wipe just the
// fakes without touching real registrations.
//
// Run with:
//   node Backend/src/seeders/fakeLawyers.js            # adds 15 lawyers
//   node Backend/src/seeders/fakeLawyers.js 50         # adds 50
//   node Backend/src/seeders/fakeLawyers.js --clear    # removes all fakes
//
// Also exposed via npm:
//   npm run seed:fake-lawyers
//   npm run seed:fake-lawyers:clear

import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { faker } from "@faker-js/faker";

import { pool } from "../config/db.js";

// Bar-license prefix used to tag every seeded row. The --clear
// command finds and deletes rows by this prefix, so do NOT change
// it without also updating the cleanup query.
const FAKE_LICENSE_PREFIX = "FAKE-";

// Same shared password for every fake lawyer. They're never meant
// to log in — this is just so the column isn't null. bcrypt-hashed
// on insert per AGENTS.md.
const FAKE_PASSWORD = "FakeLawyer@123";

const SPECIALIZATIONS = ["Civil", "Family"];

// Realistic Pakistani (Punjab/Gujranwala-region) names so the demo
// directory looks authentic for a Pakistani civil/family-court app —
// faker's default locale produces Western names that look out of place.
const PK_FIRST_NAMES = [
  "Ahmed", "Ali", "Hassan", "Hussain", "Bilal", "Usman", "Omar", "Hamza",
  "Faisal", "Kamran", "Imran", "Asif", "Tariq", "Zain", "Saad", "Fahad",
  "Waqar", "Rizwan", "Noman", "Adnan", "Junaid", "Shahzaib", "Danish",
  "Ayesha", "Fatima", "Zainab", "Maryam", "Hina", "Sana", "Amna", "Sadia",
  "Nida", "Iqra", "Rabia", "Mahnoor", "Areeba", "Komal", "Saba", "Bushra",
  "Nimra", "Sidra", "Aiman", "Laiba",
];
const PK_LAST_NAMES = [
  "Khan", "Ahmed", "Ali", "Malik", "Butt", "Chaudhry", "Sheikh", "Qureshi",
  "Hussain", "Iqbal", "Raza", "Nawaz", "Farooq", "Aslam", "Javed", "Mahmood",
  "Bhatti", "Gondal", "Tarar", "Cheema", "Sindhu", "Warraich", "Bajwa",
  "Awan", "Rana", "Shah", "Siddiqui", "Abbasi", "Mughal", "Dar", "Sial",
];

const DISTRICT_BARS = [
  "Gujranwala",
  "Lahore",
  "Karachi",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Sialkot",
  "Sargodha",
];

// Pakistan-format CNIC: 5 digits - 7 digits - 1 digit. Random
// rather than tied to real districts; not allowed-prefix-checked
// because we're bypassing the API and the column is just VARCHAR.
function fakeCnic() {
  const seg1 = String(faker.number.int({ min: 10000, max: 99999 }));
  const seg2 = String(faker.number.int({ min: 1000000, max: 9999999 }));
  const seg3 = String(faker.number.int({ min: 1, max: 9 }));
  return `${seg1}-${seg2}-${seg3}`;
}

// +923XXXXXXXXX — standard Pakistani mobile format. The registration
// validator only enforces length<=20, so anything matching that is
// safe here.
function fakePhone() {
  const tail = String(faker.number.int({ min: 100000000, max: 999999999 }));
  return `+923${tail}`;
}

// 120-char cap (matches the backend validator). Keep it short and
// flavorful so the directory looks varied without bloated paragraphs.
function fakeBio(specialization) {
  const focus =
    specialization === "Civil"
      ? "property, contract, and tenancy disputes"
      : "custody, maintenance, and family-court matters";
  const tagline = faker.helpers.arrayElement([
    "Clear-headed advocacy for",
    "Practical, outcome-focused on",
    "Detail-driven counsel for",
    "Approachable representation in",
  ]);
  return `${tagline} ${focus}.`.slice(0, 120);
}

async function clearFakeLawyers(client) {
  // Cascading FK from users → lawyer_profiles + auth_sessions +
  // lawyer_verification_documents handles the related rows. We
  // identify the fake users by joining through lawyer_profiles on
  // the marker prefix so we never touch real registrations.
  const result = await client.query(
    `DELETE FROM users
     WHERE id IN (
       SELECT user_id FROM lawyer_profiles
       WHERE bar_license_number LIKE $1
     )
     RETURNING id, email`,
    [`${FAKE_LICENSE_PREFIX}%`]
  );

  console.log(`Removed ${result.rowCount} fake lawyer${result.rowCount === 1 ? "" : "s"}.`);
}

async function insertFakeLawyer(client, lawyerRoleId, passwordHash) {
  const firstName = faker.helpers.arrayElement(PK_FIRST_NAMES);
  const lastName = faker.helpers.arrayElement(PK_LAST_NAMES);
  // Email is uniqued by the users table; the random UUID
  // disambiguates a name that happens to collide with a real or
  // previously-seeded row.
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${randomUUID().slice(0, 6)}@example.test`;
  const phone = fakePhone();
  const cnic = fakeCnic();

  const specialization = faker.helpers.arrayElement(SPECIALIZATIONS);
  const districtBar = faker.helpers.arrayElement(DISTRICT_BARS);
  const experienceYears = faker.number.int({ min: 1, max: 25 });
  const barLicenseNumber = `${FAKE_LICENSE_PREFIX}${randomUUID().slice(0, 8)}`;
  const bio = fakeBio(specialization);

  // 1) users row. Active + email-verified + local password so the
  // directory query's WHERE filter accepts them.
  const userResult = await client.query(
    `INSERT INTO users (
       role_id, first_name, last_name, email, phone, cnic,
       password_hash, auth_provider, email_verified, account_status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'local', true, 'active')
     RETURNING id`,
    [lawyerRoleId, firstName, lastName, email, phone, cnic, passwordHash]
  );
  const userId = userResult.rows[0].id;

  // 2) lawyer_profiles row. verification_status='approved' so the
  // GET /api/lawyers filter picks them up without an admin click.
  await client.query(
    `INSERT INTO lawyer_profiles (
       user_id, specialization, district_bar, bar_license_number,
       experience_years, bio,
       cnic_match, cnic_verification_status, verification_status, verified_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, true, 'matched', 'approved', NOW())`,
    [
      userId,
      specialization,
      districtBar,
      barLicenseNumber,
      experienceYears,
      bio,
    ]
  );

  return { email, firstName, lastName, specialization, districtBar };
}

async function main() {
  // CLI parsing — minimal: --clear nukes existing fakes, a positive
  // integer overrides the default count, anything else falls back
  // to the default of 15.
  const arg = process.argv[2];

  if (arg === "--clear") {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await clearFakeLawyers(client);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
      await pool.end();
    }
    return;
  }

  const requestedCount = Number.parseInt(arg, 10);
  const count = Number.isFinite(requestedCount) && requestedCount > 0 ? requestedCount : 15;

  // Bcrypt is slow by design — hashing the same password once
  // outside the loop saves ~200ms per lawyer.
  const passwordHash = await bcrypt.hash(FAKE_PASSWORD, 12);

  const roleResult = await pool.query(
    `SELECT id FROM roles WHERE name = 'lawyer'`
  );
  if (roleResult.rowCount === 0) {
    throw new Error(
      "roles table has no 'lawyer' row. Re-run schema.sql to recreate reference data."
    );
  }
  const lawyerRoleId = roleResult.rows[0].id;

  console.log(`Seeding ${count} fake approved lawyer${count === 1 ? "" : "s"}…`);

  let succeeded = 0;
  for (let i = 0; i < count; i++) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const lawyer = await insertFakeLawyer(client, lawyerRoleId, passwordHash);
      await client.query("COMMIT");
      succeeded += 1;
      console.log(
        `  ${i + 1}. ${lawyer.firstName} ${lawyer.lastName} — ${lawyer.specialization} (${lawyer.districtBar})`
      );
    } catch (err) {
      await client.query("ROLLBACK");
      // Most likely a unique-constraint collision on email / cnic /
      // bar_license_number — log and continue so a single retry
      // doesn't lose the rest of the batch.
      console.warn(`  ${i + 1}. skipped: ${err.message}`);
    } finally {
      client.release();
    }
  }

  console.log(`Done. Inserted ${succeeded} of ${count}.`);
  await pool.end();
}

main().catch((err) => {
  console.error("seedFakeLawyers failed:", err.message);
  process.exit(1);
});
