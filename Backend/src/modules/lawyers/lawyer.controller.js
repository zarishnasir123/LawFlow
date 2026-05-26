import { listApprovedLawyers } from "./lawyer.service.js";

export async function listLawyers(req, res) {
  const result = await listApprovedLawyers({
    search: req.query.search,
    specialization: req.query.specialization,
    limit: req.query.limit,
    offset: req.query.offset,
  });

  return res.status(200).json(result);
}
