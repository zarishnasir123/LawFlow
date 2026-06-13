import {
  approveCaseForRegistrar,
  getCaseForRegistrar,
  listSubmittedCasesForRegistrar,
  returnCaseForRegistrar
} from "./registrarReview.service.js";

// req.user.sub is the registrar's user id (JWT payload — see issueSessionTokens
// in auth.service.js). The service resolves their tehsil from that id.

// R1: GET /api/registrar/cases
export async function listRegistrarQueue(req, res) {
  const cases = await listSubmittedCasesForRegistrar({
    registrarUserId: req.user.sub
  });

  return res.status(200).json({ cases });
}

// R2: GET /api/registrar/cases/:caseId
export async function getRegistrarCase(req, res) {
  const found = await getCaseForRegistrar({
    caseId: req.params.caseId,
    registrarUserId: req.user.sub
  });

  return res.status(200).json({ case: found });
}

// R3: PATCH /api/registrar/cases/:caseId/approve
export async function approveRegistrarCase(req, res) {
  const updated = await approveCaseForRegistrar({
    caseId: req.params.caseId,
    registrarUserId: req.user.sub
  });

  return res.status(200).json({ case: updated });
}

// R4: PATCH /api/registrar/cases/:caseId/return
export async function returnRegistrarCase(req, res) {
  const updated = await returnCaseForRegistrar({
    caseId: req.params.caseId,
    registrarUserId: req.user.sub,
    // Validator has already trimmed + non-empty-checked this.
    remarks: req.body.remarks.trim()
  });

  return res.status(200).json({ case: updated });
}
