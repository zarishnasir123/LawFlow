import {
  createCase,
  deleteCaseAttachment,
  deleteCaseForLawyer,
  getCaseForLawyer,
  getLawyerDashboardStats,
  listCaseAttachments,
  listCaseTypes,
  listCasesForLawyer,
  listSignedCasesForLawyer,
  resolveCaseTemplate,
  submitCase,
  updateCase,
  uploadAttachmentToCase
} from "./cases.service.js";

export async function getCaseTypes(req, res) {
  const types = await listCaseTypes();
  return res.status(200).json({ caseTypes: types });
}

// Streams the .docx template for the given case_types.code.
//
// Returns the raw Word document with the correct OOXML MIME type so the
// browser presents it as a download (or the editor can pipe it through
// mammoth → HTML for in-app rendering in Module 3 Phase 2).
export async function downloadCaseTemplate(req, res) {
  const template = await resolveCaseTemplate(req.params.code);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${template.fileName}"`
  );

  return res.sendFile(template.filePath);
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
    clientUserId: req.body.clientUserId || null,
    oppositePartyName: req.body.oppositePartyName.trim(),
    assignedTehsil: req.body.assignedTehsil?.trim() || null
  });

  return res.status(201).json({ case: created });
}

export async function listMyCases(req, res) {
  const cases = await listCasesForLawyer({ lawyerUserId: req.user.sub });
  return res.status(200).json({ cases });
}

// Lawyer dashboard stat tiles, scoped to the logged-in lawyer (req.user.sub).
// Returns { activeCases, pendingSubmissions, clientSigned, totalEarnings }.
export async function getDashboardStats(req, res) {
  const stats = await getLawyerDashboardStats({ lawyerUserId: req.user.sub });
  return res.status(200).json(stats);
}

export async function listMySignedCases(req, res) {
  const cases = await listSignedCasesForLawyer({
    lawyerUserId: req.user.sub,
  });
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
    oppositePartyName: req.body.oppositePartyName?.trim(),
    assignedTehsil: req.body.assignedTehsil?.trim()
  };

  const updated = await updateCase({
    caseId: req.params.caseId,
    lawyerUserId: req.user.sub,
    updates
  });

  return res.status(200).json({ case: updated });
}

// Submit a case to the registrar for review. The service enforces the
// status guard, ownership, and the tehsil / signed-PDF prerequisites.
export async function submitMyCase(req, res) {
  const submitted = await submitCase({
    caseId: req.params.caseId,
    lawyerUserId: req.user.sub
  });

  return res.status(200).json({ case: submitted });
}

// Hard-delete a case the lawyer owns. The service enforces ownership in the
// DELETE's WHERE clause (404 if not found / not owned), relies on FK cascades
// to remove dependents, returns a 409 if a RESTRICT FK blocks the delete, and
// best-effort sweeps the case's storage objects. 204 No Content on success.
export async function deleteMyCase(req, res) {
  await deleteCaseForLawyer({
    caseId: req.params.caseId,
    lawyerUserId: req.user.sub
  });

  return res.status(204).end();
}

// =====================================================================
// Case attachments
// =====================================================================

export async function postCaseAttachment(req, res) {
  const attachment = await uploadAttachmentToCase({
    caseId: req.params.caseId,
    lawyerUserId: req.user.sub,
    file: req.file,
  });
  return res.status(201).json({ attachment });
}

export async function getCaseAttachments(req, res) {
  const attachments = await listCaseAttachments({
    caseId: req.params.caseId,
    lawyerUserId: req.user.sub,
  });
  return res.status(200).json({ attachments });
}

export async function removeCaseAttachment(req, res) {
  await deleteCaseAttachment({
    caseId: req.params.caseId,
    attachmentId: req.params.attachmentId,
    lawyerUserId: req.user.sub,
  });
  return res.status(204).end();
}
