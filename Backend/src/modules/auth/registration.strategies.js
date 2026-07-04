function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(value, fallback = null) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getField(payload, ...names) {
  for (const name of names) {
    if (payload[name] !== undefined) {
      return payload[name];
    }
  }

  return undefined;
}

function mapDocumentReference(payload, objectName, urlNames) {
  const document = payload[objectName];

  if (document && typeof document === "object") {
    return {
      storageBucket: optionalString(getField(document, "storageBucket", "storage_bucket")),
      storagePath: optionalString(getField(document, "storagePath", "storage_path")),
      fileName: optionalString(getField(document, "fileName", "file_name")),
      mimeType: optionalString(getField(document, "mimeType", "mime_type")),
      fileSize: optionalNumber(getField(document, "fileSize", "file_size"))
    };
  }

  const documentUrl = optionalString(getField(payload, ...urlNames));

  if (!documentUrl) {
    return null;
  }

  return {
    storageBucket: "external-reference",
    storagePath: documentUrl,
    fileName: null,
    mimeType: null,
    fileSize: null
  };
}

async function insertLawyerDocument(dbClient, lawyerProfileId, documentType, document) {
  if (!document) {
    return;
  }

  // Store only Supabase private bucket/path metadata here; never store public legal document URLs.
  await dbClient.query(
    `INSERT INTO lawyer_verification_documents (
      lawyer_profile_id,
      document_type,
      storage_bucket,
      storage_path,
      file_name,
      mime_type,
      file_size
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      lawyerProfileId,
      documentType,
      document.storageBucket,
      document.storagePath,
      document.fileName,
      document.mimeType,
      document.fileSize
    ]
  );
}

function splitFullName(fullName, fallbackEmail) {
  const trimmed = optionalString(fullName);

  if (trimmed) {
    const parts = trimmed.split(/\s+/);
    return {
      firstName: parts[0],
      lastName: parts.length > 1 ? parts.slice(1).join(" ") : ""
    };
  }

  const localPart = fallbackEmail ? fallbackEmail.split("@")[0] : "user";
  return { firstName: localPart, lastName: "" };
}

export const registrationStrategies = {
  client: {
    roleName: "client",

    mapProfileData(payload) {
      return {
        address: optionalString(payload.address),
        city: optionalString(payload.city),
        tehsil: optionalString(payload.tehsil)
      };
    },

    async createProfile(dbClient, userId, profileData) {
      await dbClient.query(
        `INSERT INTO client_profiles (user_id, address, city, tehsil)
        VALUES ($1, $2, $3, $4)`,
        [
          userId,
          profileData.address,
          profileData.city,
          profileData.tehsil
        ]
      );

      return {};
    }
  },

  googleClient: {
    roleName: "client",
    authProvider: "google",

    mapProfileData(payload) {
      const { firstName, lastName } = splitFullName(payload.fullName, payload.email);

      return {
        firstName,
        lastName,
        address: null,
        city: null,
        tehsil: null
      };
    },

    async createProfile(dbClient, userId) {
      await dbClient.query(
        `INSERT INTO client_profiles (user_id) VALUES ($1)`,
        [userId]
      );

      return {};
    }
  },

  lawyer: {
    roleName: "lawyer",

    mapProfileData(payload) {
      return {
        specialization: optionalString(payload.specialization)?.toLowerCase(),
        districtBar: optionalString(getField(payload, "districtBar", "district_bar")),
        barLicenseNumber: optionalString(getField(payload, "barLicenseNumber", "bar_license_number")),
        experienceYears: optionalNumber(getField(payload, "experienceYears", "experience_years"), 0),
        degreeDocument: mapDocumentReference(payload, "degreeDocument", [
          "lawDegreeDocUrl",
          "law_degree_doc_url"
        ]),
        licenseCardFrontImage: mapDocumentReference(payload, "licenseCardFrontImage", [
          "barLicenseCardFrontUrl",
          "bar_license_card_front_url"
        ]),
        licenseCardBackImage: mapDocumentReference(payload, "licenseCardBackImage", [
          "barLicenseCardBackUrl",
          "bar_license_card_back_url"
        ])
      };
    },

    async createProfile(dbClient, userId, profileData) {
      const lawyerProfileResult = await dbClient.query(
        `INSERT INTO lawyer_profiles (
          user_id,
          specialization,
          district_bar,
          bar_license_number,
          experience_years,
          cnic_match,
          cnic_match_remarks,
          cnic_verification_status,
          verification_status
        )
        VALUES ($1, $2, $3, $4, $5, false, $6, 'not_checked', 'pending')
        RETURNING id, verification_status, cnic_match`,
        [
          userId,
          profileData.specialization,
          profileData.districtBar,
          profileData.barLicenseNumber,
          profileData.experienceYears,
          "CNIC OCR check pending; document will be reviewed by admin"
        ]
      );

      const lawyerProfile = lawyerProfileResult.rows[0];

      await insertLawyerDocument(
        dbClient,
        lawyerProfile.id,
        "law_degree",
        profileData.degreeDocument
      );
      await insertLawyerDocument(
        dbClient,
        lawyerProfile.id,
        "bar_license_card_front",
        profileData.licenseCardFrontImage
      );
      await insertLawyerDocument(
        dbClient,
        lawyerProfile.id,
        "bar_license_card_back",
        profileData.licenseCardBackImage
      );

      return {
        verificationStatus: lawyerProfile.verification_status,
        cnicMatch: lawyerProfile.cnic_match
      };
    }
  }
};
