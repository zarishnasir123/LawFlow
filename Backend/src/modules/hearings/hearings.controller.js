import * as hearingsService from "./hearings.service.js";

export async function getCourtrooms(req, res) {
  const courtrooms = await hearingsService.listActiveCourtrooms();
  return res.status(200).json({ courtrooms });
}

export async function getHolidays(req, res) {
  const holidays = await hearingsService.listHolidays();
  return res.status(200).json({ holidays });
}

export async function createHoliday(req, res) {
  const holiday = await hearingsService.addHoliday({
    date: req.body.date,
    reason: req.body.reason
  });
  return res.status(201).json({ holiday });
}

export async function removeHoliday(req, res) {
  await hearingsService.deleteHoliday({ id: req.params.id });
  return res.status(200).json({ message: "Holiday deleted successfully", id: req.params.id });
}

export async function getProposedSlot(req, res) {
  const proposal = await hearingsService.getProposedHearingSlot({
    caseId: req.params.caseId,
    registrarUserId: req.user.sub
  });
  return res.status(200).json({ proposal });
}

export async function confirmProposedHearing(req, res) {
  const hearing = await hearingsService.confirmHearing({
    caseId: req.params.caseId,
    registrarUserId: req.user.sub,
    date: req.body.date,
    startTime: req.body.startTime,
    courtroomId: req.body.courtroomId,
    hearingType: req.body.hearingType
  });
  return res.status(200).json({ hearing });
}

export async function getCaseHearings(req, res) {
  const hearings = await hearingsService.listCaseHearings({
    caseId: req.params.caseId,
    userId: req.user.sub,
    userRole: req.user.role
  });
  return res.status(200).json({ hearings });
}

export async function reschedule(req, res) {
  const hearing = await hearingsService.rescheduleHearing({
    hearingId: req.params.hearingId,
    registrarUserId: req.user.sub,
    newDate: req.body.newDate,
    newStartTime: req.body.newStartTime,
    newCourtroomId: req.body.newCourtroomId
  });
  return res.status(200).json({ hearing });
}

export async function cancel(req, res) {
  const result = await hearingsService.cancelHearing({
    hearingId: req.params.hearingId,
    registrarUserId: req.user.sub
  });
  return res.status(200).json({ message: "Hearing cancelled successfully", id: result.hearingId });
}

export async function postOutcome(req, res) {
  const outcome = await hearingsService.recordOutcome({
    hearingId: req.params.hearingId,
    registrarUserId: req.user.sub,
    outcome: req.body.outcome,
    remarks: req.body.remarks,
    nextHearingType: req.body.nextHearingType
  });
  return res.status(200).json({ outcome });
}

export async function getLawyerHearings(req, res) {
  const hearings = await hearingsService.listLawyerHearings({
    lawyerUserId: req.user.sub
  });
  return res.status(200).json({ hearings });
}

export async function getClientHearings(req, res) {
  const hearings = await hearingsService.listClientHearings({
    clientUserId: req.user.sub
  });
  return res.status(200).json({ hearings });
}

export async function getRegistrarQueue(req, res) {
  const hearings = await hearingsService.listRegistrarHearings({
    registrarUserId: req.user.sub,
    status: req.query.status
  });
  return res.status(200).json({ hearings });
}
