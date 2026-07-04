import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import { normalizeCnic } from "../../utils/cnic.js";
import { downloadLawyerDocument } from "../../services/storage.service.js";
import { generateGeminiVision } from "../../services/gemini.service.js";
import { parseOcrResponse, stripDashes } from "./cnicOcr.parse.js";

const OCR_PROMPT =
  "This is a Pakistani Bar Council advocate license card. " +
  "Find and extract the 13-digit CNIC/NIC number (formatted as XXXXX-XXXXXXX-X or as a 13-digit number). " +
  "Return ONLY that number with dashes and nothing else. " +
  "If you cannot find any 13-digit CNIC/NIC number, return exactly NOT_FOUND.";

export const CNIC_VERIFICATION_STATUS = {
  NOT_CHECKED: "not_checked",
  MATCHED: "matched",
  MISMATCH: "mismatch",
  UNREADABLE: "unreadable"
};

// Core service: reads the NIC off a lawyer's bar license card (front or back)
// using Gemini vision and compares it to the CNIC the lawyer entered.
//
// Returns { extractedCnic, enteredCnic, match, readable, remarks, cnicVerificationStatus }.
// Persists the result into lawyer_profiles.
export async function verifyLawyerCnicFromCard(lawyerProfileId) {
  // 1. Fetch the lawyer's entered CNIC + card document metadata (front, back or combined).
  const { rows } = await pool.query(
    `SELECT
       lp.verification_status,
       u.cnic AS entered_cnic,
       d.storage_path,
       d.mime_type,
       d.document_type
     FROM lawyer_profiles lp
     JOIN users u ON u.id = lp.user_id
     LEFT JOIN lawyer_verification_documents d
       ON d.lawyer_profile_id = lp.id
      AND d.document_type IN ('bar_license_card_back', 'bar_license_card_front', 'bar_license_card')
     WHERE lp.id = $1`,
    [lawyerProfileId]
  );

  if (rows.length === 0) {
    throw new ApiError(404, "Lawyer profile not found.");
  }

  const vStatus = rows[0].verification_status;
  if (vStatus === "approved" || vStatus === "rejected") {
    throw new ApiError(422, "Cannot run OCR on an approved or rejected lawyer.");
  }

  const enteredCnic = normalizeCnic(rows[0].entered_cnic);

  if (!enteredCnic) {
    const remarks = "No CNIC on file for this user.";
    const status = CNIC_VERIFICATION_STATUS.UNREADABLE;
    await persistResult(lawyerProfileId, { match: false, remarks, status });
    return {
      extractedCnic: null,
      enteredCnic: null,
      match: false,
      readable: false,
      remarks,
      cnicVerificationStatus: status
    };
  }

  const enteredDigits = stripDashes(enteredCnic);
  if (enteredDigits.length !== 13) {
    throw new ApiError(
      422,
      "This lawyer's CNIC on file is invalid, so it can't be verified."
    );
  }

  const documents = rows.filter(r => r.storage_path);
  if (documents.length === 0) {
    throw new ApiError(
      422,
      "No card images found for this lawyer. OCR cannot run."
    );
  }

  // Preference order: check back first, then front, then combined
  const docPreference = {
    bar_license_card_back: 1,
    bar_license_card_front: 2,
    bar_license_card: 3
  };
  documents.sort((a, b) => (docPreference[a.document_type] || 9) - (docPreference[b.document_type] || 9));

  let finalResult = null;
  let documentFoundInStorage = false;

  // 2. Loop through each uploaded document and try to read the CNIC.
  for (const doc of documents) {
    try {
      const imageBuffer = await downloadLawyerDocument(doc.storage_path);
      if (!imageBuffer) continue;

      documentFoundInStorage = true;

      const imageBase64 = imageBuffer.toString("base64");
      const imageMimeType = doc.mime_type || "image/jpeg";

      // 3. Send to Gemini vision.
      const ocrText = await generateGeminiVision({
        prompt: OCR_PROMPT,
        imageBase64,
        imageMimeType
      });

      // 4. Parse the OCR response.
      const parsed = parseOcrResponse(ocrText);
      if (parsed.readable) {
        const isMatch = parsed.digits === enteredDigits;
        const remarks = isMatch
          ? `CNIC successfully verified. The uploaded card matches the entered CNIC.`
          : `CNIC mismatch detected. Card shows ${parsed.formatted}; entered CNIC is ${enteredCnic}. Please review manually.`;

        finalResult = {
          extractedCnic: parsed.formatted,
          enteredCnic,
          match: isMatch,
          readable: true,
          remarks,
          cnicVerificationStatus: isMatch
            ? CNIC_VERIFICATION_STATUS.MATCHED
            : CNIC_VERIFICATION_STATUS.MISMATCH
        };

        // If we found a matching CNIC, we can stop scanning!
        if (isMatch) {
          break;
        }
      }
    } catch (err) {
      // Let definitive API errors (429, 502, 504) bubble up to the controller
      // instead of silently falling through to "Unable to verify".
      if (err instanceof ApiError) throw err;
      console.error(`[cnicOcr] OCR failed for doc type ${doc.document_type}:`, err);
    }
  }

  if (!documentFoundInStorage) {
    throw new ApiError(422, "Document not found.");
  }

  // 5. If none of the documents were readable, return not_found.
  if (!finalResult) {
    finalResult = {
      extractedCnic: null,
      enteredCnic,
      match: false,
      readable: false,
      remarks: "Unable to verify the CNIC from the uploaded card. Please review the document manually.",
      cnicVerificationStatus: CNIC_VERIFICATION_STATUS.UNREADABLE
    };
  }

  // 6. Persist the final result.
  await persistResult(lawyerProfileId, {
    match: finalResult.match,
    remarks: finalResult.remarks,
    status: finalResult.cnicVerificationStatus
  });

  return finalResult;
}

async function persistResult(lawyerProfileId, { match, remarks, status }) {
  await pool.query(
    `UPDATE lawyer_profiles
        SET cnic_match = $1,
            cnic_match_remarks = $2,
            cnic_verification_status = $3,
            updated_at = NOW()
      WHERE id = $4`,
    [match, remarks, status, lawyerProfileId]
  );
}
