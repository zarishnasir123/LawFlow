import {
  createCase,
  getCaseForLawyer,
  listCaseTypes,
  listCasesForLawyer,
  updateCase
} from "./cases.service.js";

export async function getCaseTypes(req, res) {
  const types = await listCaseTypes();
  return res.status(200).json({ caseTypes: types });
}

export async function createMyCase(req, res) {
  const created = await createCase({
    lawyerUserId: req.user.sub,
    caseTypeId: req.body.caseTypeId,
    title: req.body.title.trim(),
    description: req.body.description?.trim() || null,
    clientName: req.body.clientName.trim(),
    clientEmail: req.body.clientEmail?.trim() || null,
    clientPhone: req.body.clientPhone?.trim() || null,
    oppositePartyName: req.body.oppositePartyName.trim()
  });

  return res.status(201).json({ case: created });
}

export async function listMyCases(req, res) {
  const cases = await listCasesForLawyer({ lawyerUserId: req.user.sub });
  return res.status(200).json({ cases });
}

export async function getMyCase(req, res) {
  const found = await getCaseForLawyer({
    caseId: req.params.caseId,
    lawyerUserId: req.user.sub
  });

  return res.status(200).json({ case: found });
}

export async function patchMyCase(req, res) {
  const updates = {
    title: req.body.title?.trim(),
    description: req.body.description?.trim(),
    clientName: req.body.clientName?.trim(),
    clientEmail: req.body.clientEmail?.trim(),
    clientPhone: req.body.clientPhone?.trim(),
    oppositePartyName: req.body.oppositePartyName?.trim()
  };

  const updated = await updateCase({
    caseId: req.params.caseId,
    lawyerUserId: req.user.sub,
    updates
  });

  return res.status(200).json({ case: updated });
}
