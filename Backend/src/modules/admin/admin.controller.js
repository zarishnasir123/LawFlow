import { getDashboardStats, getRecentActivityFeed } from "./admin.service.js";
import { getAdminCaseDetail, listAdminCases } from "./adminCases.service.js";
import { getMoneyOverview } from "./adminMoney.service.js";
import {
  getCommissionRateSetting,
  updateCommissionRate,
} from "./platformSettings.service.js";
import {
  listPayoutsForAdmin,
  transitionPayout,
  getPayoutReceiptRef,
} from "../payments/payouts.service.js";
import { createNotification } from "../notifications/notifications.service.js";
import {
  uploadPayoutReceipt as uploadPayoutReceiptObject,
  getPayoutReceiptSignedUrl,
  deletePayoutReceipt,
} from "../../services/storage.service.js";
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

// GET /api/admin/commission-rate  → { commissionRate, updatedAt }
export async function getCommissionRateHandler(req, res) {
  const data = await getCommissionRateSetting();
  return res.status(200).json(data);
}

// PUT /api/admin/commission-rate  { commissionRate } → updates the platform-wide
// rate. Only affects FUTURE payments (existing rows keep their snapshotted rate).
export async function updateCommissionRateHandler(req, res) {
  const data = await updateCommissionRate(req.body.commissionRate);
  return res.status(200).json({ message: "Commission rate updated", ...data });
}

// GET /api/admin/money-overview
// Platform-wide money picture for the admin Finances page: totals (collected,
// platform fees, paid out, owed), a reconciliation self-check, and a per-lawyer
// breakdown. Shape: { totals, reconciliation, perLawyer[] }.
export async function getMoneyOverviewHandler(req, res) {
  const overview = await getMoneyOverview();
  return res.status(200).json(overview);
}

// GET /api/admin/payouts?status=
// The payout queue: every payout (optionally filtered by status) with the
// lawyer's name/email, open requests first. Shape: { items: AdminPayout[] }.
export async function listPayoutsHandler(req, res) {
  const items = await listPayoutsForAdmin({ status: req.query.status });
  return res.status(200).json({ items });
}

// PATCH /api/admin/payouts/:payoutId
// Moves a payout to processing | failed | cancelled. (Marking PAID goes through
// the dedicated multipart endpoint below, which also captures transfer proof.)
// Notifies the lawyer best-effort when a payout fails (money released).
export async function updatePayoutHandler(req, res) {
  const { status, note } = req.body;
  const payout = await transitionPayout({
    payoutId: req.params.payoutId,
    adminUserId: req.user.sub,
    status,
    note,
  });

  try {
    if (status === "failed") {
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

// POST /api/admin/payouts/:payoutId/mark-paid  (multipart/form-data)
// Marks a payout paid WITH proof of the manual bank transfer: a reference, the
// transfer date, the sending bank/method, and an uploaded receipt file. The
// receipt is uploaded first; if the status transition then fails, we delete the
// orphaned file. The lawyer is notified (and sees the typed proof, not the
// receipt image).
export async function markPayoutPaidHandler(req, res) {
  const payoutId = req.params.payoutId;
  const { reference, transferDate, transferBank, note } = req.body;

  if (!req.file) {
    throw new ApiError(400, "A receipt of the transfer is required.");
  }

  const uploaded = await uploadPayoutReceiptObject({
    payoutId,
    fileBuffer: req.file.buffer,
    mimeType: req.file.mimetype,
    originalName: req.file.originalname,
  });

  let payout;
  try {
    payout = await transitionPayout({
      payoutId,
      adminUserId: req.user.sub,
      status: "paid",
      reference,
      note,
      transferDate,
      transferBank,
      receiptBucket: uploaded.storageBucket,
      receiptPath: uploaded.storagePath,
    });
  } catch (error) {
    // The transition failed (e.g. payout not found / already terminal) — don't
    // leave the just-uploaded receipt orphaned in storage.
    await deletePayoutReceipt(uploaded.storageBucket, uploaded.storagePath);
    throw error;
  }

  try {
    await createNotification({
      userId: payout.lawyerUserId,
      type: "payout_paid",
      title: "You've been paid",
      message: `Your payout of Rs ${payout.amount.toLocaleString()} has been sent to your bank account${
        payout.reference ? ` (ref: ${payout.reference})` : ""
      }.`,
    });
  } catch (notifyErr) {
    console.error(
      "Payout paid notification failed:",
      notifyErr?.message || notifyErr
    );
  }

  return res.status(200).json({ message: "Payout marked paid", data: payout });
}

// GET /api/admin/payouts/:payoutId/receipt
// Admin-only short-lived signed URL to view a payout's transfer receipt.
// 404 when the payout has no receipt on file.
export async function getPayoutReceiptHandler(req, res) {
  const ref = await getPayoutReceiptRef(req.params.payoutId);
  if (!ref) {
    throw new ApiError(404, "No receipt on file for this payout.");
  }
  const url = await getPayoutReceiptSignedUrl(ref.bucket, ref.path, 300);
  if (!url) {
    throw new ApiError(503, "Receipt storage is not available right now.");
  }
  return res.status(200).json({ url });
}
