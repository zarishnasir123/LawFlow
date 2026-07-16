import { pool } from "../../src/config/db.js";
import { hashValue } from "../../src/utils/hash.js";

// Every factory user shares this password so login-flow tests can sign in.
export const TEST_PASSWORD = "Password1!";

// Hash once per test run (bcrypt at production cost is slow — ~300ms).
let cachedHash = null;
async function defaultPasswordHash() {
  if (!cachedHash) cachedHash = await hashValue(TEST_PASSWORD);
  return cachedHash;
}

let seq = 0;
export const unique = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

// Insert a users row directly (no OTP flow) — verified + active by default so
// suites can log straight in. Override any field for negative-path tests.
export async function createUser({
  role = "client",
  email = `user-${unique()}@lawflow-tests.pk`,
  firstName = "Test",
  lastName = "User",
  phone = "+92-300-1234567",
  cnic = null,
  emailVerified = true,
  accountStatus = "active",
  mustChangePassword = false,
  passwordHash,
} = {}) {
  const hash = passwordHash ?? (await defaultPasswordHash());
  const { rows } = await pool.query(
    `INSERT INTO users (
       role_id, first_name, last_name, email, phone, cnic, password_hash,
       email_verified, account_status, must_change_password
     )
     VALUES ((SELECT id FROM roles WHERE name = $1), $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [role, firstName, lastName, email, phone, cnic, hash, emailVerified, accountStatus, mustChangePassword]
  );
  return { ...rows[0], role };
}

export async function createClient(overrides = {}) {
  const user = await createUser({ role: "client", ...overrides });
  await pool.query(
    `INSERT INTO client_profiles (user_id, address, city, tehsil)
     VALUES ($1, $2, $3, $4)`,
    [user.id, overrides.address ?? "House 1, Gujranwala", overrides.city ?? "Gujranwala", overrides.tehsil ?? "Gujranwala"]
  );
  return user;
}

export async function createLawyer({
  verificationStatus = "approved",
  specialization = "civil",
  ...overrides
} = {}) {
  const user = await createUser({ role: "lawyer", ...overrides });
  const { rows } = await pool.query(
    `INSERT INTO lawyer_profiles (
       user_id, specialization, district_bar, bar_license_number,
       experience_years, verification_status
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      user.id,
      specialization,
      overrides.districtBar ?? "Gujranwala Bar Association",
      overrides.barLicenseNumber ?? `GBA-${unique()}`,
      overrides.experienceYears ?? 5,
      verificationStatus,
    ]
  );
  return { ...user, lawyerProfileId: rows[0].id };
}

export async function createRegistrar(overrides = {}) {
  const user = await createUser({ role: "registrar", ...overrides });
  const { rows } = await pool.query(
    `INSERT INTO registrar_profiles (user_id, assigned_court, assigned_tehsil)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [user.id, overrides.assignedCourt ?? "District Court Gujranwala", overrides.assignedTehsil ?? "Gujranwala"]
  );
  return { ...user, registrarProfileId: rows[0].id };
}

export async function createAdmin(overrides = {}) {
  return createUser({ role: "admin", firstName: "Admin", ...overrides });
}
