import { pool } from "../../config/db.js";
import {
  upsertServiceCharges,
  getServiceChargesByLawyerId,
  mapServiceChargesRow,
  getPublicCaseCharges,
} from "./serviceCharges.service.js";

export async function updateServiceCharges(req, res) {
  const { familyCaseFee, civilCaseFee } = req.body;
  const lawyerId = req.user.sub;

  const profileResult = await pool.query(
    `SELECT id FROM lawyer_profiles WHERE user_id = $1`,
    [lawyerId]
  );

  if (profileResult.rows.length === 0) {
    return res.status(404).json({ message: "Lawyer profile not found" });
  }

  try {
    const updated = await upsertServiceCharges(profileResult.rows[0].id, {
      familyCaseFee,
      civilCaseFee,
    });
    return res.status(200).json({
      message: "Service charges updated successfully",
      data: mapServiceChargesRow(updated),
    });
  } catch (error) {
    console.error("Error updating service charges:", error);
    return res.status(500).json({ message: "Failed to update service charges" });
  }
}

export async function getServiceCharges(req, res) {
  const lawyerId = req.user.sub;

  try {
    const charges = await getServiceChargesByLawyerId(lawyerId);
    return res.status(200).json({
      data: mapServiceChargesRow(charges),
    });
  } catch (error) {
    console.error("Error fetching service charges:", error);
    return res.status(500).json({ message: "Failed to fetch service charges" });
  }
}

export async function getServiceChargesByProfileId(req, res) {
  const { lawyerProfileId } = req.params;

  try {
    const publicCharges = await getPublicCaseCharges(lawyerProfileId);
    return res.status(200).json({ data: publicCharges });
  } catch (error) {
    console.error("Error fetching service charges:", error);
    return res.status(500).json({ message: "Failed to fetch service charges" });
  }
}
