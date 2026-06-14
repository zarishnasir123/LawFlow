import { getDashboardStats, getRecentActivityFeed } from "./admin.service.js";
import { getAdminCaseDetail, listAdminCases } from "./adminCases.service.js";
import { ApiError } from "../../utils/apiError.js";

// GET /api/admin/dashboard-stats
// Returns the real counts behind the admin dashboard's four stat cards.
// Any metric without a reliable source column is null (never fabricated).
export async function getDashboardStatsHandler(req, res) {
  const stats = await getDashboardStats();
  return res.status(200).json(stats);
}

// GET /api/admin/recent-activity
// Returns the 8 most recent real system events for the dashboard's Recent
// Activity panel, newest first. The feed is a UNION across real event
// sources (lawyer approvals/rejections/requests, registrar creation, case
// accept/return) — see getRecentActivity in admin.service.js. Shape:
//   { activities: [{ id, type, title, subject, timestamp }] }
export async function getRecentActivityHandler(req, res) {
  const result = await getRecentActivityFeed(8);
  return res.status(200).json(result);
}

// GET /api/admin/cases?search=&status=&limit=&offset=
// Admin case-traceability table: every case in the system, searchable by
// title / client name / lawyer name, filterable by lifecycle status, with
// payment-readiness fields (agreedFee / paidAmount / hasAgreement) per row.
// Validators (listAdminCasesValidator) have already 400'd bad input, so we
// pass the query straight through; the service clamps limit/offset again.
// Shape: { items: AdminCaseListItem[], pagination: { total, limit, offset } }
export async function listAdminCasesHandler(req, res) {
  const result = await listAdminCases({
    search: req.query.search,
    status: req.query.status,
    limit: req.query.limit,
    offset: req.query.offset
  });
  return res.status(200).json(result);
}

// GET /api/admin/cases/:caseId
// One case's facts + a merged, oldest-first audit timeline (real
// case_events UNION derived signing events) + a payment-readiness summary
// including the read-only payoutEligible indicator. 404 when no case
// matches the id. Shape:
//   { case, timeline: CaseTimelineEvent[], paymentReadiness }
export async function getAdminCaseDetailHandler(req, res) {
  const detail = await getAdminCaseDetail(req.params.caseId);
  if (!detail) {
    throw new ApiError(404, "Case not found");
  }
  return res.status(200).json(detail);
}
