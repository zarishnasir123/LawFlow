import { getDashboardStats, getRecentActivityFeed } from "./admin.service.js";
import { getAdminCaseDetail, listAdminCases } from "./adminCases.service.js";
import {
  listPayoutsForAdmin,
  transitionPayout,
} from "../payments/payouts.service.js";
import { createNotification } from "../notifications/notifications.service.js";
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

// GET /api/admin/payouts?status=
// The payout queue: every payout (optionally filtered by status) with the
// lawyer's name/email, open requests first. Shape: { items: AdminPayout[] }.
export async function listPayoutsHandler(req, res) {
  const items = await listPayoutsForAdmin({ status: req.query.status });
  return res.status(200).json({ items });
}

// PATCH /api/admin/payouts/:payoutId
// Admin moves a payout along its lifecycle (processing | paid | failed |
// cancelled). Marking paid requires a bank reference. The transition + ledger
// effects are validated in the service; here we additionally notify the lawyer
// (best-effort) when their money lands or a payout fails.
export async function updatePayoutHandler(req, res) {
  const { status, reference, note } = req.body;
  const payout = await transitionPayout({
    payoutId: req.params.payoutId,
    adminUserId: req.user.sub,
    status,
    reference,
    note,
  });

  try {
    if (status === "paid") {
      await createNotification({
        userId: payout.lawyerUserId,
        type: "payout_paid",
        title: "You've been paid",
        message: `Your payout of Rs ${payout.amount.toLocaleString()} has been sent to your bank account${
          payout.reference ? ` (ref: ${payout.reference})` : ""
        }.`,
      });
    } else if (status === "failed") {
      await createNotification({
        userId: payout.lawyerUserId,
        type: "payout_failed",
        title: "Payout could not be completed",
        message: `Your payout of Rs ${payout.amount.toLocaleString()} could not be processed, so the amount is back in your available balance.${
          payout.note ? ` Note: ${payout.note}` : ""
        }`,
      });
    }
  } catch (notifyErr) {
    console.error(
      "Payout status notification failed:",
      notifyErr?.message || notifyErr
    );
  }

  return res.status(200).json({ message: "Payout updated", data: payout });
}
