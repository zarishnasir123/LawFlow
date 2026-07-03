import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import { normalizeCnic } from "../../utils/cnic.js";
import { downloadLawyerDocument } from "../../services/storage.service.js";
import { generateGeminiVision } from "../../services/gemini.service.js";

// Matches a 13-digit Pakistani CNIC with optional dashes: 34101-9721875-9
// Also matches the dashless form: 3410197218759
const CNIC_PATTERN = /\d{5}-?\d{7}-?\d{1}/;

const OCR_PROMPT =
  "This is a Pakistani Bar Council advocate license card. " +
  "Find and extract the 13-digit CNIC/NIC number (formatted as XXXXX-XXXXXXX-X or as a 13-digit number). " +
  "Return ONLY that number with dashes and nothing else. " +
  "If you cannot find any 13-digit CNIC/NIC number, return exactly NOT_FOUND.";

// Formats a 13-digit string as XXXXX-XXXXXXX-X for display.
function formatCnic(digits) {
  if (digits.length !== 13) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

// Strips dashes from a CNIC for digit-only comparison.
function stripDashes(cnic) {
  return String(cnic || "").replace(/-/g, "");
}

// Attempts to extract a CNIC from the OCR response text.
// Returns { readable: true, digits, formatted } or { readable: false }.
function parseOcrResponse(text) {
  const cleaned = String(text || "").trim();

  if (cleaned === "NOT_FOUND" || !cleaned) {
    return { readable: false, digits: null, formatted: null };
  }

  const match = cleaned.match(CNIC_PATTERN);
  if (!match) {
    return { readable: false, digits: null, formatted: null };
  }

  const digits = stripDashes(match[0]);
  if (digits.length !== 13) {
    return { readable: false, digits: null, formatted: null };
  }

  return { readable: true, digits, formatted: formatCnic(digits) };
}

// Core service: reads the NIC off a lawyer's bar license card (front or back)
// using Gemini vision and compares it to the CNIC the lawyer entered.
//
// Returns { extractedCnic, enteredCnic, match, readable, remarks }.
// Persists the result into lawyer_profiles.cnic_match / cnic_match_remarks.
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
    await persistResult(lawyerProfileId, false, remarks);
    return {
      extractedCnic: null,
      enteredCnic: null,
      match: false,
      readable: false,
      remarks
    };
  }

  const enteredDigits = stripDashes(enteredCnic);
  if (enteredDigits.length !== 13) {
    throw new ApiError(422, "Entered CNIC is invalid format. Should reject before OCR.");
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

      console.log(`[cnicOcr] Gemini raw response for ${doc.document_type}:`, JSON.stringify(ocrText));

      // 4. Parse the OCR response.
      const parsed = parseOcrResponse(ocrText);
      console.log(`[cnicOcr] Parsed result:`, JSON.stringify(parsed));
      if (parsed.readable) {
        const isMatch = parsed.digits === enteredDigits;
        const remarks = isMatch
          ? `CNIC verified — card (${parsed.formatted}) matches entered CNIC.`
          : `CNIC mismatch — card shows ${parsed.formatted}, entered ${enteredCnic}. Review required.`;

        finalResult = {
          extractedCnic: parsed.formatted,
          enteredCnic,
          match: isMatch,
          readable: true,
          remarks
        };

        // If we found a matching CNIC, we can stop scanning!
        if (isMatch) {
          break;
        }
      }
    } catch (err) {
      // Let definitive API errors (429, 401, 504) bubble up to the controller
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
      remarks: "Could not read the NIC from the card image — verify manually."
    };
  }

  // 6. Persist the final result.
  await persistResult(lawyerProfileId, finalResult.match, finalResult.remarks);

  return finalResult;
}

async function persistResult(lawyerProfileId, match, remarks) {
  await pool.query(
    `UPDATE lawyer_profiles
        SET cnic_match = $1,
            cnic_match_remarks = $2,
            updated_at = NOW()
      WHERE id = $3`,
    [match, remarks, lawyerProfileId]
  );
}
