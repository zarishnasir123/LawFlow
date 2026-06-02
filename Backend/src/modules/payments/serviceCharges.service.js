import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";

function parseFee(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function mapServiceChargesRow(row) {
  if (!row) return null;
  const baseFee = parseFloat(row.base_fee) || 0;
  const family =
    parseFee(row.family_case_fee) ?? (baseFee > 0 ? baseFee : null);
  const civil = parseFee(row.civil_case_fee) ?? (baseFee > 0 ? baseFee : null);
  return {
    id: row.id,
    lawyerProfileId: row.lawyer_profile_id,
    baseFee,
    familyCaseFee: family,
    civilCaseFee: civil,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertServiceCharges(
  lawyerProfileId,
  { familyCaseFee, civilCaseFee }
) {
  const family = familyCaseFee != null ? Number(familyCaseFee) : null;
  const civil = civilCaseFee != null ? Number(civilCaseFee) : null;
  const legacyBase = Math.max(family || 0, civil || 0);

  const result = await pool.query(
    `INSERT INTO lawyer_service_charges (
      lawyer_profile_id,
      base_fee,
      family_case_fee,
      civil_case_fee
    )
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (lawyer_profile_id)
    DO UPDATE SET
      family_case_fee = EXCLUDED.family_case_fee,
      civil_case_fee = EXCLUDED.civil_case_fee,
      base_fee = GREATEST(
        COALESCE(EXCLUDED.family_case_fee, 0),
        COALESCE(EXCLUDED.civil_case_fee, 0),
        lawyer_service_charges.base_fee
      ),
      updated_at = NOW()
    RETURNING *`,
    [lawyerProfileId, legacyBase, family, civil]
  );
  return result.rows[0];
}

export async function getServiceChargesByLawyerId(lawyerId) {
  const result = await pool.query(
    `SELECT sc.*
     FROM lawyer_service_charges sc
     INNER JOIN lawyer_profiles lp ON sc.lawyer_profile_id = lp.id
     WHERE lp.user_id = $1`,
    [lawyerId]
  );
  return result.rows[0] || null;
}

export async function getServiceChargesByProfileId(lawyerProfileId) {
  const result = await pool.query(
    `SELECT * FROM lawyer_service_charges WHERE lawyer_profile_id = $1`,
    [lawyerProfileId]
  );
  return result.rows[0] || null;
}

/** Fee for a case category: family | civil */
export function getCategoryFeeFromRow(row, caseCategory) {
  if (!row) return 0;
  const mapped = mapServiceChargesRow(row);
  const cat = String(caseCategory || "").toLowerCase();
  if (cat === "family") return mapped.familyCaseFee || 0;
  if (cat === "civil") return mapped.civilCaseFee || 0;
  return 0;
}

export async function getCategoryFeeForCase(lawyerUserId, caseCategory) {
  const row = await getServiceChargesByLawyerId(lawyerUserId);
  return getCategoryFeeFromRow(row, caseCategory);
}

export async function getPublicCaseCharges(lawyerProfileId) {
  const row = await getServiceChargesByProfileId(lawyerProfileId);
  const mapped = mapServiceChargesRow(row);
  if (!mapped) return null;

  const charges = [];
  if (mapped.familyCaseFee) {
    charges.push({ category: "Family", amount: mapped.familyCaseFee });
  }
  if (mapped.civilCaseFee) {
    charges.push({ category: "Civil", amount: mapped.civilCaseFee });
  }
  if (charges.length === 0) return null;
  return { charges };
}
