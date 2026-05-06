import { randomUUID } from "node:crypto";

import { pool } from "../../config/db.js";
import {
  queueVerificationOtpEmail,
  queueWelcomeEmail
} from "../../services/email.service.js";
import {
  deleteLawyerDocuments,
  uploadLawyerDocument
} from "../../services/storage.service.js";
import { ApiError } from "../../utils/apiError.js";
import { normalizeCnic } from "../../utils/cnic.js";
import { compareHash, hashValue } from "../../utils/hash.js";
import { generateNumericOtp, getEmailOtpExpiryDate } from "../../utils/otp.js";
import { registrationStrategies } from "./registration.strategies.js";

const lawyerDocumentFields = [
  { fieldName: "degreeDocument", documentType: "law_degree" },
  { fieldName: "licenseCardFrontImage", documentType: "bar_license_card_front" },
  { fieldName: "licenseCardBackImage", documentType: "bar_license_card_back" }
];

async function uploadLawyerRegistrationDocuments({ files, lawyerKey }) {
  const uploaded = [];

  try {
    for (const { fieldName, documentType } of lawyerDocumentFields) {
      const file = files?.[fieldName]?.[0];

      if (!file) {
        throw new ApiError(400, `Missing upload for ${fieldName}`);
      }

      const result = await uploadLawyerDocument({
        documentType,
        file,
        lawyerKey
      });

      uploaded.push({ fieldName, ...result });
    }

    return uploaded;
  } catch (error) {
    if (uploaded.length > 0) {
      await deleteLawyerDocuments({
        storagePaths: uploaded.map((doc) => doc.storagePath)
      });
    }
    throw error;
  }
}

function getField(payload, ...names) {
  for (const name of names) {
    if (payload[name] !== undefined) {
      return payload[name];
    }
  }

  return undefined;
}

function normalizeOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeCommonRegistrationFields(payload) {
  return {
    firstName: normalizeOptionalString(getField(payload, "firstName", "first_name")),
    lastName: normalizeOptionalString(getField(payload, "lastName", "last_name")),
    email: normalizeOptionalString(payload.email)?.toLowerCase(),
    phoneNumber: normalizeOptionalString(getField(payload, "phoneNumber", "phone_number", "phone")),
    cnic: normalizeCnic(getField(payload, "CNIC", "cnic")),
    password: payload.password
  };
}

function toPendingRegistrationResponse({ role, commonData, emailDelivery, expiresAt, createdAt }) {
  return {
    user: {
      id: null,
      firstName: commonData.firstName,
      lastName: commonData.lastName,
      email: commonData.email,
      phone: commonData.phoneNumber,
      role,
      emailVerified: false,
      accountStatus: "pending_verification",
      verificationStatus: role === "lawyer" ? "pending" : undefined,
      createdAt
    },
    verification: {
      emailSent: emailDelivery.mode === "smtp",
      emailQueued: emailDelivery.queued,
      deliveryMode: emailDelivery.mode,
      deliveryReason: emailDelivery.reason,
      expiresAt
    }
  };
}

function toVerifiedUserResponse({ user, role, profileResult = {} }) {
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    phone: user.phone,
    role,
    emailVerified: user.email_verified,
    accountStatus: user.account_status,
    verificationStatus: profileResult.verificationStatus,
    cnicMatch: profileResult.cnicMatch,
    createdAt: user.created_at
  };
}

function parseProfileData(profileData) {
  return typeof profileData === "string" ? JSON.parse(profileData) : profileData;
}

async function getRoleId(dbClient, roleName) {
  const result = await dbClient.query(
    "SELECT id FROM roles WHERE name = $1",
    [roleName]
  );

  if (result.rowCount === 0) {
    throw new ApiError(500, `Required role is missing: ${roleName}`);
  }

  return result.rows[0].id;
}

async function deleteExpiredPendingRegistrations(dbClient) {
  await dbClient.query(
    "DELETE FROM pending_registrations WHERE expires_at < NOW()"
  );
}

async function ensureUniqueUserIdentity(dbClient, { email, cnic }) {
  const result = await dbClient.query(
    "SELECT email, cnic FROM users WHERE email = $1 OR cnic = $2 LIMIT 1",
    [email, cnic]
  );

  if (result.rowCount === 0) {
    return;
  }

  const existingUser = result.rows[0];

  if (existingUser.email === email) {
    throw new ApiError(409, "Email is already registered");
  }

  throw new ApiError(409, "CNIC is already registered");
}

async function ensureUniquePendingIdentity(dbClient, { email, cnic }) {
  const result = await dbClient.query(
    `SELECT email, cnic
    FROM pending_registrations
    WHERE email = $1 OR cnic = $2`,
    [email, cnic]
  );

  const conflictingRegistration = result.rows.find((row) => (
    row.email !== email || row.cnic !== cnic
  ));

  if (!conflictingRegistration) {
    return;
  }

  if (conflictingRegistration.email === email) {
    throw new ApiError(409, "Email is already being registered. Please verify the pending email first.");
  }

  throw new ApiError(409, "CNIC is already being registered. Please verify the pending email first.");
}

async function ensureUniqueLawyerLicense(dbClient, { email, barLicenseNumber }) {
  if (!barLicenseNumber) {
    return;
  }

  const registeredLicenseResult = await dbClient.query(
    "SELECT id FROM lawyer_profiles WHERE bar_license_number = $1 LIMIT 1",
    [barLicenseNumber]
  );

  if (registeredLicenseResult.rowCount > 0) {
    throw new ApiError(409, "Bar license number is already registered");
  }

  const pendingLicenseResult = await dbClient.query(
    `SELECT email
    FROM pending_registrations
    WHERE profile_data ->> 'barLicenseNumber' = $1
    LIMIT 1`,
    [barLicenseNumber]
  );

  if (pendingLicenseResult.rowCount > 0 && pendingLicenseResult.rows[0].email !== email) {
    throw new ApiError(409, "Bar license number is already being registered. Please verify the pending email first.");
  }
}

async function createPendingRegistration(dbClient, {
  roleId,
  commonData,
  profileData,
  passwordHash,
  otpHash,
  expiresAt
}) {
  const result = await dbClient.query(
    `INSERT INTO pending_registrations (
      role_id,
      email,
      cnic,
      first_name,
      last_name,
      phone_number,
      password_hash,
      profile_data,
      otp_hash,
      expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (email) DO UPDATE
    SET role_id = EXCLUDED.role_id,
        cnic = EXCLUDED.cnic,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone_number = EXCLUDED.phone_number,
        password_hash = EXCLUDED.password_hash,
        profile_data = EXCLUDED.profile_data,
        otp_hash = EXCLUDED.otp_hash,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW()
    RETURNING created_at`,
    [
      roleId,
      commonData.email,
      commonData.cnic,
      commonData.firstName,
      commonData.lastName,
      commonData.phoneNumber,
      passwordHash,
      profileData,
      otpHash,
      expiresAt
    ]
  );

  return result.rows[0];
}

export async function startRegistration({ role, payload, files }) {
  const strategy = registrationStrategies[role];

  if (!strategy) {
    throw new ApiError(400, "Unsupported registration role");
  }

  const commonData = normalizeCommonRegistrationFields(payload);
  const client = await pool.connect();
  const uploadedStoragePaths = [];

  try {
    await deleteExpiredPendingRegistrations(client);
    const roleId = await getRoleId(client, strategy.roleName);

    await ensureUniqueUserIdentity(client, commonData);
    await ensureUniquePendingIdentity(client, commonData);

    let workingPayload = payload;

    if (strategy.roleName === "lawyer") {
      const previewProfile = strategy.mapProfileData(payload);

      await ensureUniqueLawyerLicense(client, {
        email: commonData.email,
        barLicenseNumber: previewProfile.barLicenseNumber
      });

      const lawyerKey = randomUUID();
      const uploads = await uploadLawyerRegistrationDocuments({ files, lawyerKey });

      uploadedStoragePaths.push(...uploads.map((doc) => doc.storagePath));

      const uploadByField = uploads.reduce((acc, upload) => {
        acc[upload.fieldName] = upload;
        return acc;
      }, {});

      workingPayload = {
        ...payload,
        degreeDocument: uploadByField.degreeDocument,
        licenseCardFrontImage: uploadByField.licenseCardFrontImage,
        licenseCardBackImage: uploadByField.licenseCardBackImage
      };
    }

    const profileData = strategy.mapProfileData(workingPayload);

    const otp = generateNumericOtp();
    const otpHash = await hashValue(otp);
    const passwordHash = await hashValue(commonData.password);
    const expiresAt = getEmailOtpExpiryDate();

    const pendingRegistration = await createPendingRegistration(client, {
      roleId,
      commonData,
      profileData,
      passwordHash,
      otpHash,
      expiresAt
    });

    const emailDelivery = queueVerificationOtpEmail({
      email: commonData.email,
      otp,
      firstName: commonData.firstName
    });

    return toPendingRegistrationResponse({
      role: strategy.roleName,
      commonData,
      emailDelivery,
      expiresAt,
      createdAt: pendingRegistration.created_at
    });
  } catch (error) {
    if (uploadedStoragePaths.length > 0) {
      await deleteLawyerDocuments({ storagePaths: uploadedStoragePaths });
    }

    if (error.code === "23505") {
      throw new ApiError(409, "Email, CNIC, or bar license number is already being registered");
    }

    throw error;
  } finally {
    client.release();
  }
}

async function findPendingRegistrationByEmail(dbClient, email, { lock = false } = {}) {
  const result = await dbClient.query(
    `SELECT
      pending_registrations.*,
      roles.name AS role
    FROM pending_registrations
    JOIN roles ON roles.id = pending_registrations.role_id
    WHERE pending_registrations.email = $1
    ${lock ? "FOR UPDATE OF pending_registrations" : ""}`,
    [email]
  );

  return result.rows[0] || null;
}

export async function completeRegistrationVerification({ email, otp }) {
  const normalizedEmail = email.trim().toLowerCase();
  const pendingRegistration = await findPendingRegistrationByEmail(pool, normalizedEmail);

  if (!pendingRegistration) {
    throw new ApiError(400, "Registration verification was not found. Please register again.");
  }

  if (new Date(pendingRegistration.expires_at).getTime() < Date.now()) {
    throw new ApiError(400, "OTP expired. Please request a new OTP.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lockedPendingRegistration = await findPendingRegistrationByEmail(client, normalizedEmail, {
      lock: true
    });

    if (!lockedPendingRegistration) {
      throw new ApiError(400, "Registration verification was not found. Please register again.");
    }

    if (new Date(lockedPendingRegistration.expires_at).getTime() < Date.now()) {
      throw new ApiError(400, "OTP expired. Please request a new OTP.");
    }

    const otpMatches = await compareHash(otp, lockedPendingRegistration.otp_hash);

    if (!otpMatches) {
      throw new ApiError(400, "Invalid verification OTP");
    }

    const strategy = registrationStrategies[lockedPendingRegistration.role];

    if (!strategy) {
      throw new ApiError(500, "Registration role is not supported");
    }

    await ensureUniqueUserIdentity(client, {
      email: lockedPendingRegistration.email,
      cnic: lockedPendingRegistration.cnic
    });

    const accountStatus = strategy.roleName === "client" ? "active" : "inactive";
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
        account_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'local', true, $8)
      RETURNING id, first_name, last_name, email, phone, email_verified, account_status, created_at`,
      [
        lockedPendingRegistration.role_id,
        lockedPendingRegistration.first_name,
        lockedPendingRegistration.last_name,
        lockedPendingRegistration.email,
        lockedPendingRegistration.phone_number,
        lockedPendingRegistration.cnic,
        lockedPendingRegistration.password_hash,
        accountStatus
      ]
    );

    const user = userResult.rows[0];
    const profileData = parseProfileData(lockedPendingRegistration.profile_data);
    const profileResult = await strategy.createProfile(client, user.id, profileData, {
      cnic: lockedPendingRegistration.cnic
    });

    await client.query(
      "DELETE FROM pending_registrations WHERE id = $1",
      [lockedPendingRegistration.id]
    );

    await client.query("COMMIT");

    queueWelcomeEmail({
      email: user.email,
      firstName: user.first_name
    });

    return toVerifiedUserResponse({
      user,
      role: strategy.roleName,
      profileResult
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw new ApiError(409, "Email, CNIC, or bar license number is already registered");
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function resendRegistrationVerificationOtp({ email }) {
  const normalizedEmail = email.trim().toLowerCase();
  const client = await pool.connect();

  try {
    const pendingRegistration = await findPendingRegistrationByEmail(client, normalizedEmail);

    if (!pendingRegistration) {
      throw new ApiError(400, "Registration session expired. Please register again.");
    }

    const otp = generateNumericOtp();
    const otpHash = await hashValue(otp);
    const expiresAt = getEmailOtpExpiryDate();

    await client.query(
      `UPDATE pending_registrations
      SET otp_hash = $1,
          expires_at = $2
      WHERE id = $3`,
      [otpHash, expiresAt, pendingRegistration.id]
    );

    const emailDelivery = queueVerificationOtpEmail({
      email: pendingRegistration.email,
      otp,
      firstName: pendingRegistration.first_name
    });

    return {
      email: pendingRegistration.email,
      emailSent: emailDelivery.mode === "smtp",
      emailQueued: emailDelivery.queued,
      deliveryMode: emailDelivery.mode,
      deliveryReason: emailDelivery.reason,
      expiresAt
    };
  } finally {
    client.release();
  }
}
