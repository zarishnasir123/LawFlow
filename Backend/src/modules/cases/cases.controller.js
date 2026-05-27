import {
  createCase,
  deleteCaseAttachment,
  getCaseForLawyer,
  listCaseAttachments,
  listCaseTypes,
  listCasesForLawyer,
  listSignedCasesForLawyer,
  resolveCaseTemplate,
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
    oppositePartyName: req.body.oppositePartyName.trim()
  });

  return res.status(201).json({ case: created });
}

export async function listMyCases(req, res) {
  const cases = await listCasesForLawyer({ lawyerUserId: req.user.sub });
  return res.status(200).json({ cases });
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
    oppositePartyName: req.body.oppositePartyName?.trim()
  };

  const updated = await updateCase({
    caseId: req.params.caseId,
    lawyerUserId: req.user.sub,
    updates
  });

  return res.status(200).json({ case: updated });
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
