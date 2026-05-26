import { getApprovedLawyerById, listApprovedLawyers } from "./lawyer.service.js";

export async function listLawyers(req, res) {
  const result = await listApprovedLawyers({
    search: req.query.search,
    specialization: req.query.specialization,
    limit: req.query.limit,
    offset: req.query.offset,
  });

  return res.status(200).json(result);
}

export async function getLawyer(req, res) {
  const lawyer = await getApprovedLawyerById(req.params.lawyerProfileId);
  return res.status(200).json({ lawyer });
}
