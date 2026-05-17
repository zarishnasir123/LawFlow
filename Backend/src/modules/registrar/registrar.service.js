import { randomBytes } from "node:crypto";

import { pool } from "../../config/db.js";
import { deliverRegistrarCredentialsEmail } from "../../services/email.service.js";
import { ApiError } from "../../utils/apiError.js";
import { hashValue } from "../../utils/hash.js";

// Columns surfaced to the admin API. Kept in one place so every endpoint
// returns the same shape and we don't need a follow-up SELECT after writes.
const REGISTRAR_RETURNING_COLUMNS = `
  registrar_profiles.id                          AS registrar_profile_id,
  registrar_profiles.user_id,
  registrar_profiles.assigned_court,
  registrar_profiles.assigned_tehsil,
  registrar_profiles.credentials_email_sent_at,
  registrar_profiles.created_at,
  registrar_profiles.updated_at,
  users.first_name,
  users.last_name,
  users.email,
  users.phone,
  users.cnic,
  users.account_status,
  users.email_verified,
  users.must_change_password
`;

function mapRegistrar(row) {
  return {
    id: row.user_id,
    registrarProfileId: row.registrar_profile_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    cnic: row.cnic,
    accountStatus: row.account_status,
    emailVerified: row.email_verified,
    mustChangePassword: row.must_change_password,
    assignedCourt: row.assigned_court,
    assignedTehsil: row.assigned_tehsil,
    credentialsEmailSentAt: row.credentials_email_sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getRegistrarRoleId(dbClient) {
  const result = await dbClient.query(
    "SELECT id FROM roles WHERE name = 'registrar'"
  );

  if (result.rowCount === 0) {
    throw new ApiError(500, "Registrar role is missing. Re-run schema.sql.");
  }

  return result.rows[0].id;
}

async function ensureUniqueIdentity(dbClient, { email, cnic }) {
  const userResult = await dbClient.query(
    "SELECT email, cnic FROM users WHERE email = $1 OR cnic = $2 LIMIT 1",
    [email, cnic]
  );

  if (userResult.rowCount > 0) {
    const existing = userResult.rows[0];

    if (existing.email === email) {
      throw new ApiError(409, "Email is already registered");
    }

    throw new ApiError(409, "CNIC is already registered");
  }

  const pendingResult = await dbClient.query(
    "SELECT email, cnic FROM pending_registrations WHERE email = $1 OR cnic = $2 LIMIT 1",
    [email, cnic]
  );

  if (pendingResult.rowCount > 0) {
    const existing = pendingResult.rows[0];

    if (existing.email === email) {
      throw new ApiError(409, "Email is in a pending registration. Resolve or expire it first.");
    }

    throw new ApiError(409, "CNIC is in a pending registration. Resolve or expire it first.");
  }
}

// Single-round-trip fetch by registrar_profiles.id. Used by GET /:id and
// the admin list (which keeps its COUNT OVER for pagination).
async function fetchRegistrarById(dbClient, registrarProfileId) {
  const result = await dbClient.query(
    `SELECT ${REGISTRAR_RETURNING_COLUMNS}
    FROM registrar_profiles
    JOIN users ON users.id = registrar_profiles.user_id
    WHERE registrar_profiles.id = $1`,
    [registrarProfileId]
  );

  return result.rows[0] || null;
}

export async function createRegistrar({
  firstName,
  lastName,
  email,
  phone,
  cnic,
  assignedCourt,
  assignedTehsil,
  createdByAdminId
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim();
  const normalizedCnic = cnic.trim();
  const normalizedCourt = assignedCourt?.trim() || null;
  const normalizedTehsil = assignedTehsil?.trim() || null;

  // Generate the temporary password server-side. Removes the chance of a
  // weak admin-picked password and keeps the plaintext off the admin's
  // browser/network entirely — it only ever leaves this server via the
  // outgoing SMTP send below.
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashValue(temporaryPassword);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const roleId = await getRegistrarRoleId(client);

    await ensureUniqueIdentity(client, {
      email: normalizedEmail,
      cnic: normalizedCnic
    });

    // Account starts active with email_verified=true (admin vouched for it)
    // and must_change_password=true so the registrar cannot keep using the
    // emailed temporary password indefinitely.
    const userResult = await client.query(
      `INSERT INTO users (
        role_id,
        first_name,
        last_name,
        email,
        phone,
        cnic,
        password_hash,
        auth_provider,
        email_verified,
        account_status,
        must_change_password
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'local', true, 'active', true)
      RETURNING id`,
      [
        roleId,
        firstName.trim(),
        lastName.trim(),
        normalizedEmail,
        normalizedPhone,
        normalizedCnic,
        passwordHash
      ]
    );

    const userId = userResult.rows[0].id;

    // Profile insert returns the joined shape directly so we avoid a
    // post-commit re-fetch (which would race against a parallel DELETE).
    const profileResult = await client.query(
      `WITH inserted AS (
        INSERT INTO registrar_profiles (
          user_id,
          assigned_court,
          assigned_tehsil,
          created_by_admin_id,
          credentials_email_sent_at
        )
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      )
      SELECT ${REGISTRAR_RETURNING_COLUMNS}
      FROM inserted AS registrar_profiles
      JOIN users ON users.id = registrar_profiles.user_id`,
      [userId, normalizedCourt, normalizedTehsil, createdByAdminId]
    );

    await client.query("COMMIT");

    // Synchronous delivery so a failed SMTP handshake surfaces back to the
    // admin UI instead of silently disappearing into a setImmediate. The
    // plaintext password leaves memory the moment this promise resolves.
    const emailDelivery = await deliverRegistrarCredentialsEmail({
      email: normalizedEmail,
      firstName: firstName.trim(),
      temporaryPassword
    });

    return {
      registrar: mapRegistrar(profileResult.rows[0]),
      emailDelivery
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw new ApiError(409, "Email or CNIC is already registered");
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function listRegistrars({ limit = 20, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
  const safeOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);

  const result = await pool.query(
    `SELECT ${REGISTRAR_RETURNING_COLUMNS},
      COUNT(*) OVER () AS total_count
    FROM registrar_profiles
    JOIN users ON users.id = registrar_profiles.user_id
    ORDER BY registrar_profiles.created_at DESC
    LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset]
  );

  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;

  return {
    items: result.rows.map(mapRegistrar),
    pagination: {
      total,
      limit: safeLimit,
      offset: safeOffset
    }
  };
}

export async function getRegistrar(registrarProfileId) {
  const row = await fetchRegistrarById(pool, registrarProfileId);

  if (!row) {
    throw new ApiError(404, "Registrar not found");
  }

  return mapRegistrar(row);
}

export async function updateRegistrar({
  registrarProfileId,
  firstName,
  lastName,
  phone,
  assignedCourt,
  assignedTehsil
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lookup = await client.query(
      `SELECT id, user_id
      FROM registrar_profiles
      WHERE id = $1
      FOR UPDATE`,
      [registrarProfileId]
    );

    if (lookup.rowCount === 0) {
      throw new ApiError(404, "Registrar not found");
    }

    const { user_id: userId } = lookup.rows[0];

    await client.query(
      `UPDATE users
      SET first_name = $1,
          last_name = $2,
          phone = $3,
          updated_at = NOW()
      WHERE id = $4`,
      [firstName.trim(), lastName.trim(), phone.trim(), userId]
    );

    await client.query(
      `UPDATE registrar_profiles
      SET assigned_court = $1,
          assigned_tehsil = $2,
          updated_at = NOW()
      WHERE id = $3`,
      [
        assignedCourt?.trim() || null,
        assignedTehsil?.trim() || null,
        registrarProfileId
      ]
    );

    // Fetch the joined view inside the same transaction so the row we return
    // matches exactly what we just wrote, even under concurrent edits.
    const refreshed = await client.query(
      `SELECT ${REGISTRAR_RETURNING_COLUMNS}
      FROM registrar_profiles
      JOIN users ON users.id = registrar_profiles.user_id
      WHERE registrar_profiles.id = $1`,
      [registrarProfileId]
    );

    await client.query("COMMIT");

    return mapRegistrar(refreshed.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setRegistrarStatus({ registrarProfileId, accountStatus }) {
  if (!["active", "inactive"].includes(accountStatus)) {
    throw new ApiError(400, "Status must be active or inactive");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lookup = await client.query(
      `SELECT id, user_id
      FROM registrar_profiles
      WHERE id = $1
      FOR UPDATE`,
      [registrarProfileId]
    );

    if (lookup.rowCount === 0) {
      throw new ApiError(404, "Registrar not found");
    }

    const { user_id: userId } = lookup.rows[0];

    await client.query(
      `UPDATE users
      SET account_status = $1,
          updated_at = NOW()
      WHERE id = $2`,
      [accountStatus, userId]
    );

    // Force-logout on deactivation so an already-signed-in registrar can't
    // continue working from a cached refresh cookie.
    if (accountStatus === "inactive") {
      await client.query(
        `UPDATE auth_sessions
        SET is_revoked = true,
            revoked_at = NOW()
        WHERE user_id = $1 AND is_revoked = false`,
        [userId]
      );
    }

    const refreshed = await client.query(
      `SELECT ${REGISTRAR_RETURNING_COLUMNS}
      FROM registrar_profiles
      JOIN users ON users.id = registrar_profiles.user_id
      WHERE registrar_profiles.id = $1`,
      [registrarProfileId]
    );

    await client.query("COMMIT");

    return mapRegistrar(refreshed.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteRegistrar(registrarProfileId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lookup = await client.query(
      `SELECT registrar_profiles.id,
              registrar_profiles.user_id,
              users.account_status
      FROM registrar_profiles
      JOIN users ON users.id = registrar_profiles.user_id
      WHERE registrar_profiles.id = $1
      FOR UPDATE OF registrar_profiles`,
      [registrarProfileId]
    );

    if (lookup.rowCount === 0) {
      throw new ApiError(404, "Registrar not found");
    }

    const { user_id: userId, account_status: status } = lookup.rows[0];

    // Mirrors the admin UI guard. Forcing deactivation first avoids the
    // surprise of an "active" account vanishing while a registrar is logged in.
    if (status === "active") {
      throw new ApiError(409, "Deactivate registrar account before deleting it.");
    }

    // ON DELETE CASCADE on registrar_profiles.user_id + auth_sessions.user_id +
    // email_verification_otps.user_id + password_reset_tokens.user_id clears
    // the rest. registrar_profiles.created_by_admin_id is ON DELETE SET NULL
    // so deleting a registrar never affects rows owned by other registrars.
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Issues a fresh temporary password, updates the bcrypt hash on users, and
// sends it to the registrar. The previous temporary password is invalidated
// the moment the new hash is written. must_change_password is set back to
// true so the registrar must rotate the new temporary password too.
export async function resendRegistrarCredentials(registrarProfileId) {
  const client = await pool.connect();
  let emailPayload = null;
  let refreshedRow = null;

  try {
    await client.query("BEGIN");

    const lookup = await client.query(
      `SELECT registrar_profiles.id,
              registrar_profiles.user_id,
              users.email,
              users.first_name,
              users.account_status
      FROM registrar_profiles
      JOIN users ON users.id = registrar_profiles.user_id
      WHERE registrar_profiles.id = $1
      FOR UPDATE OF registrar_profiles`,
      [registrarProfileId]
    );

    if (lookup.rowCount === 0) {
      throw new ApiError(404, "Registrar not found");
    }

    const { user_id: userId, email, first_name, account_status } = lookup.rows[0];

    if (account_status !== "active") {
      throw new ApiError(409, "Activate the registrar before sending credentials.");
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashValue(temporaryPassword);

    await client.query(
      `UPDATE users
      SET password_hash = $1,
          must_change_password = true,
          failed_login_attempts = 0,
          locked_until = NULL,
          updated_at = NOW()
      WHERE id = $2`,
      [passwordHash, userId]
    );

    await client.query(
      `UPDATE registrar_profiles
      SET credentials_email_sent_at = NOW(),
          updated_at = NOW()
      WHERE id = $1`,
      [registrarProfileId]
    );

    // Revoke any active session so the registrar must sign in with the new
    // temporary password.
    await client.query(
      `UPDATE auth_sessions
      SET is_revoked = true,
          revoked_at = NOW()
      WHERE user_id = $1 AND is_revoked = false`,
      [userId]
    );

    const refreshed = await client.query(
      `SELECT ${REGISTRAR_RETURNING_COLUMNS}
      FROM registrar_profiles
      JOIN users ON users.id = registrar_profiles.user_id
      WHERE registrar_profiles.id = $1`,
      [registrarProfileId]
    );

    await client.query("COMMIT");

    emailPayload = { email, firstName: first_name, temporaryPassword };
    refreshedRow = refreshed.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  // Email delivery happens outside the transaction so an SMTP failure cannot
  // roll back the password rotation — the registrar's old credentials are
  // already invalidated by the COMMIT above, regardless of whether the new
  // ones reach the inbox.
  const emailDelivery = await deliverRegistrarCredentialsEmail(emailPayload);

  return {
    registrar: mapRegistrar(refreshedRow),
    emailDelivery
  };
}

// Generates a 12-char temporary password that satisfies the existing password
// rule (>=8 chars, at least one digit, at least one special char).
//
// Uses rejection sampling instead of modulo-on-random-byte so distribution is
// uniform across each character set, even when the set size doesn't evenly
// divide 256. The modulo-bias would be tiny (~0.4%) but a defender reviewer
// will rightly flag it, and rejection sampling is cheap.
function generateTemporaryPassword() {
  const alpha = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const specials = "!@#$%^&*";

  function pickFrom(charset) {
    const setSize = charset.length;
    const limit = Math.floor(256 / setSize) * setSize;

    // Loop until we draw a byte in the unbiased range. Expected iterations
    // are tiny (<2) for every charset we use.
    while (true) {
      const byte = randomBytes(1)[0];
      if (byte < limit) {
        return charset[byte % setSize];
      }
    }
  }

  const chars = [
    pickFrom(alpha),
    pickFrom(alpha),
    pickFrom(alpha),
    pickFrom(alpha),
    pickFrom(alpha),
    pickFrom(alpha),
    pickFrom(alpha),
    pickFrom(alpha),
    pickFrom(digits),
    pickFrom(digits),
    pickFrom(specials),
    pickFrom(specials)
  ];

  // Fisher–Yates with rejection-sampled randomness so the digit/special
  // positions are not always at fixed indices.
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const range = index + 1;
    const limit = Math.floor(256 / range) * range;
    let swap;
    while (true) {
      const byte = randomBytes(1)[0];
      if (byte < limit) {
        swap = byte % range;
        break;
      }
    }
    [chars[index], chars[swap]] = [chars[swap], chars[index]];
  }

  return chars.join("");
}
