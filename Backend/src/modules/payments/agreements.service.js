import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import { isValidUuid } from "../../utils/uuid.js";
import {
  getCategoryFeeForCase,
  getServiceChargesByLawyerId,
} from "./serviceCharges.service.js";

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function mapInstallment(row) {
  return {
    id: row.id,
    installmentNumber: row.installment_number,
    amount: parseFloat(row.amount),
    dueDate: row.due_date,
    status: row.status,
    paidAt: row.paid_at,
  };
}

export function buildEqualMonthlyInstallments(totalAmount, installmentCount) {
  const total = roundMoney(totalAmount);
  const count = Math.max(1, Number(installmentCount) || 1);
  // Whole-rupee installments (no paisa). The final installment absorbs any
  // remainder so the parts still sum exactly to the total.
  const perInstallment = Math.floor(total / count);
  const rows = [];
  const now = new Date();
  let allocated = 0;

  for (let i = 1; i <= count; i += 1) {
    const amount = i === count ? roundMoney(total - allocated) : perInstallment;
    allocated = roundMoney(allocated + amount);
    const due = new Date(now.getFullYear(), now.getMonth() + i, now.getDate());
    rows.push({
      amount,
      dueDate: due.toISOString().slice(0, 10),
    });
  }
  return rows;
}

export async function resolveClientUserIdForCase(caseRow) {
  if (caseRow.client_user_id) {
    return caseRow.client_user_id;
  }

  if (!caseRow.client_email) {
    return null;
  }

  const result = await pool.query(
    `SELECT u.id
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE LOWER(TRIM(u.email::text)) = LOWER(TRIM($1))
       AND r.name = 'client'
       AND u.account_status IN ('active', 'pending_verification')
     LIMIT 1`,
    [caseRow.client_email.trim()]
  );

  return result.rows[0]?.id || null;
}

export async function getCaseForAgreement({ caseId, lawyerUserId }) {
  if (!isValidUuid(caseId)) {
    throw new ApiError(400, "Invalid case ID");
  }

  const result = await pool.query(
    `SELECT
      c.*,
      ct.category AS case_type_category,
      ct.display_name AS case_type_display_name
    FROM cases c
    INNER JOIN case_types ct ON ct.id = c.case_type_id
    WHERE c.id = $1 AND c.lawyer_user_id = $2`,
    [caseId, lawyerUserId]
  );

  if (result.rows.length === 0) {
    throw new ApiError(404, "Case not found");
  }

  const row = result.rows[0];
  const clientUserId = await resolveClientUserIdForCase(row);

  return {
    id: row.id,
    title: row.title,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    clientUserId,
    caseCategory: row.case_type_category,
    caseTypeName: row.case_type_display_name,
    status: row.status,
  };
}

export async function listLawyerAgreementCases(lawyerUserId) {
  const result = await pool.query(
    `SELECT
      c.id,
      c.title,
      c.client_name,
      c.client_email,
      c.client_phone,
      c.client_user_id,
      c.status,
      ct.category AS case_type_category,
      ct.display_name AS case_type_display_name,
      a.id AS agreement_id
    FROM cases c
    INNER JOIN case_types ct ON ct.id = c.case_type_id
    LEFT JOIN agreements a ON a.case_id = c.id
    WHERE c.lawyer_user_id = $1
    ORDER BY c.created_at DESC`,
    [lawyerUserId]
  );

  const cases = [];
  for (const row of result.rows) {
    const clientUserId =
      row.client_user_id || (await resolveClientUserIdForCase(row));
    cases.push({
      id: row.id,
      title: row.title,
      clientName: row.client_name,
      clientEmail: row.client_email,
      clientPhone: row.client_phone,
      clientUserId,
      caseCategory: row.case_type_category,
      caseTypeName: row.case_type_display_name,
      status: row.status,
      hasAgreement: Boolean(row.agreement_id),
      agreementId: row.agreement_id,
    });
  }

  return cases;
}

export async function markOverdueInstallments(agreementId = null) {
  const params = [];
  let filter = "";
  if (agreementId) {
    params.push(agreementId);
    filter = " AND agreement_id = $1";
  }

  await pool.query(
    `UPDATE installments
     SET status = 'overdue', updated_at = NOW()
     WHERE status = 'pending'
       AND due_date IS NOT NULL
       AND due_date < CURRENT_DATE${filter}`,
    params
  );
}

function validateInstallmentSchedule(installments, remainingBalance) {
  if (roundMoney(remainingBalance) <= 0) {
    return;
  }

  if (!Array.isArray(installments) || installments.length === 0) {
    throw new ApiError(400, "At least one installment is required");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDates = new Set();
  let total = 0;

  for (let i = 0; i < installments.length; i += 1) {
    const item = installments[i];
    const amount = roundMoney(item.amount);
    if (amount <= 0) {
      throw new ApiError(400, `Installment ${i + 1} amount must be greater than zero`);
    }

    if (!item.dueDate) {
      throw new ApiError(400, `Installment ${i + 1} requires a due date`);
    }

    const due = new Date(item.dueDate);
    if (Number.isNaN(due.getTime())) {
      throw new ApiError(400, `Installment ${i + 1} has an invalid due date`);
    }
    due.setHours(0, 0, 0, 0);
    if (due < today) {
      throw new ApiError(400, `Installment ${i + 1} due date cannot be in the past`);
    }

    const dueKey = due.toISOString().slice(0, 10);
    if (dueDates.has(dueKey)) {
      throw new ApiError(400, "Duplicate due dates are not allowed");
    }
    dueDates.add(dueKey);
    total += amount;
  }

  if (roundMoney(total) !== roundMoney(remainingBalance)) {
    throw new ApiError(
      400,
      `Installment total (${roundMoney(total)}) must equal agreed total (${roundMoney(remainingBalance)})`
    );
  }
}

export async function createAgreementWithInstallments({
  caseId,
  lawyerUserId,
  clientUserId,
  lawyerBaseFee,
  agreedTotalAmount,
  installments,
  frequency = "monthly",
  installmentCount = 1,
}) {
  if (!isValidUuid(caseId) || !isValidUuid(clientUserId)) {
    throw new ApiError(400, "Invalid case or client identifier");
  }

  const agreedTotal = roundMoney(agreedTotalAmount);
  const baseFee = roundMoney(lawyerBaseFee);

  if (agreedTotal <= 0) {
    throw new ApiError(400, "Agreed total amount must be greater than zero");
  }

  if (baseFee < 0) {
    throw new ApiError(400, "Base fee cannot be negative");
  }

  // Installments cover the full agreed contract value; base fee is informational only.
  const installmentTarget = agreedTotal;

  const caseInfo = await getCaseForAgreement({ caseId, lawyerUserId });

  if (!caseInfo.clientUserId || caseInfo.clientUserId !== clientUserId) {
    throw new ApiError(403, "Client does not match this case");
  }

  const existing = await pool.query(
    "SELECT id FROM agreements WHERE case_id = $1",
    [caseId]
  );
  if (existing.rows.length > 0) {
    throw new ApiError(409, "An agreement already exists for this case");
  }

  let normalizedInstallments = installments;
  if (!normalizedInstallments?.length) {
    const count = Math.max(1, Number(installmentCount) || 1);
    // Whole-rupee installments (no paisa); the last absorbs the remainder so
    // they sum to the target exactly.
    const amountEach = Math.floor(installmentTarget / count);
    normalizedInstallments = [];
    const now = new Date();
    let allocated = 0;
    for (let i = 1; i <= count; i += 1) {
      const amount = i === count ? roundMoney(installmentTarget - allocated) : amountEach;
      allocated = roundMoney(allocated + amount);
      let dueDate;
      if (frequency === "quarterly") {
        dueDate = new Date(now.getFullYear(), now.getMonth() + i * 3, now.getDate());
      } else if (frequency === "semi_annual") {
        dueDate = new Date(now.getFullYear(), now.getMonth() + i * 6, now.getDate());
      } else {
        dueDate = new Date(now.getFullYear(), now.getMonth() + i, now.getDate());
      }
      normalizedInstallments.push({
        amount,
        dueDate: dueDate.toISOString().slice(0, 10),
      });
    }
  }

  validateInstallmentSchedule(normalizedInstallments, installmentTarget);

  const scheduleForInsert = normalizedInstallments;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const agreementResult = await client.query(
      `INSERT INTO agreements (
        case_id,
        lawyer_user_id,
        client_user_id,
        lawyer_base_fee,
        agreed_total_amount,
        currency,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'PKR', 'active')
      RETURNING *`,
      [caseId, lawyerUserId, clientUserId, baseFee, agreedTotal]
    );

    const agreement = agreementResult.rows[0];

    const paymentPlanResult = await client.query(
      `INSERT INTO payment_plans (
        agreement_id,
        total_amount,
        frequency,
        installment_count
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        agreement.id,
        installmentTarget,
        frequency,
        scheduleForInsert.length,
      ]
    );

    const paymentPlan = paymentPlanResult.rows[0];
    const createdInstallments = [];

    // NOTE: the lawyer's configured case charge (baseFee) is stored on the
    // agreement (lawyer_base_fee) for reference ONLY — it is NOT billed as a
    // separate "Service Charge" installment. The client pays exactly the agreed
    // installment plan (which already equals the full agreed total). Pre-filling
    // the plan total from the configured fee happens in the lawyer UI.

    for (let i = 0; i < scheduleForInsert.length; i += 1) {
      const inst = scheduleForInsert[i];
      const installmentNumber = i + 1;
      const installmentResult = await client.query(
        `INSERT INTO installments (
          payment_plan_id,
          agreement_id,
          installment_number,
          amount,
          due_date,
          status
        )
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING *`,
        [
          paymentPlan.id,
          agreement.id,
          installmentNumber,
          roundMoney(inst.amount),
          inst.dueDate,
        ]
      );
      createdInstallments.push(installmentResult.rows[0]);
    }

    if (!caseInfo.clientUserId) {
      await client.query(
        `UPDATE cases SET client_user_id = $1, updated_at = NOW() WHERE id = $2`,
        [clientUserId, caseId]
      );
    }

    await client.query("COMMIT");

    return {
      agreement,
      paymentPlan,
      installments: createdInstallments,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      throw new ApiError(409, "An agreement already exists for this case");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function createPaymentPlanForCase({
  caseId,
  lawyerUserId,
  totalAmount,
  installmentCount,
  installments: providedInstallments,
}) {
  const total = roundMoney(totalAmount);
  // When the lawyer customizes the schedule, the number of rows they send is
  // the source of truth for the count; otherwise use the requested count.
  const hasCustomSchedule =
    Array.isArray(providedInstallments) && providedInstallments.length > 0;
  const count = hasCustomSchedule
    ? providedInstallments.length
    : Math.max(1, Number(installmentCount) || 1);

  if (total <= 0) {
    throw new ApiError(400, "Total amount must be greater than zero");
  }
  if (count > 48) {
    throw new ApiError(400, "Installment count cannot exceed 48");
  }

  const caseInfo = await getCaseForAgreement({ caseId, lawyerUserId });
  const category = String(caseInfo.caseCategory || "").toLowerCase();

  if (category !== "family" && category !== "civil") {
    throw new ApiError(400, "Invalid case category for payment planning");
  }

  const categoryFee = await getCategoryFeeForCase(lawyerUserId, category);
  if (categoryFee <= 0) {
    const label = category === "family" ? "Family" : "Civil";
    throw new ApiError(
      400,
      `Set your ${label} case charges in Service Charges before creating a payment plan.`
    );
  }

  if (!caseInfo.clientUserId) {
    throw new ApiError(
      400,
      "Link a registered client to this case before creating a payment plan."
    );
  }

  const existing = await pool.query(
    "SELECT id FROM agreements WHERE case_id = $1",
    [caseId]
  );
  if (existing.rows.length > 0) {
    throw new ApiError(409, "A payment plan already exists for this case");
  }

  // Amounts are always system-computed (equal whole-rupee split, last absorbs
  // the remainder) so the schedule sums to the total exactly — the lawyer only
  // controls the due dates. Each row defaults to a monthly cadence and is
  // overridden by the lawyer-chosen date when one was supplied.
  const baseSchedule = buildEqualMonthlyInstallments(total, count);
  const installments = baseSchedule.map((row, index) => {
    const customDueDate = hasCustomSchedule
      ? providedInstallments[index]?.dueDate
      : null;
    return {
      amount: row.amount,
      dueDate: customDueDate || row.dueDate,
    };
  });

  return createAgreementWithInstallments({
    caseId,
    lawyerUserId,
    clientUserId: caseInfo.clientUserId,
    lawyerBaseFee: categoryFee,
    agreedTotalAmount: total,
    installments,
    frequency: "monthly",
    installmentCount: count,
  });
}

// Remove a case's payment plan (the agreement and everything under it:
// installments + any failed/unfinished payment attempts), so the lawyer can then
// delete the case. Allowed ONLY when the client has NOT successfully paid
// anything — a case with a recorded payment keeps its history (and can't be
// deleted either). Owner-scoped: getCaseForAgreement 404s for a non-owner.
export async function removePaymentPlanForLawyer({ caseId, lawyerUserId }) {
  // Validates the id + that this lawyer owns the case (404 otherwise).
  await getCaseForAgreement({ caseId, lawyerUserId });

  const paid = await pool.query(
    `SELECT 1 FROM payment_transactions
     WHERE case_id = $1 AND status = 'success'
     LIMIT 1`,
    [caseId]
  );
  if (paid.rows.length > 0) {
    throw new ApiError(
      409,
      "This case has a recorded payment, so its payment plan can't be removed."
    );
  }

  // Deleting the agreement cascades to payment_plans → installments → any
  // failed/pending transactions (no successful ones exist, per the check above).
  const result = await pool.query(
    `DELETE FROM agreements WHERE case_id = $1`,
    [caseId]
  );
  if (result.rowCount === 0) {
    throw new ApiError(404, "There's no payment plan to remove for this case.");
  }

  return { removed: true };
}

export async function getAgreementSnapshot(agreementId, userId, role) {
  if (!isValidUuid(agreementId)) {
    throw new ApiError(400, "Invalid agreement ID");
  }

  await markOverdueInstallments(agreementId);

  const result = await pool.query(
    `SELECT
      a.*,
      c.title AS case_title,
      c.client_name,
      c.client_email,
      c.client_phone,
      ct.category AS case_category,
      ct.display_name AS case_type_name,
      CONCAT(lu.first_name, ' ', lu.last_name) AS lawyer_name,
      CONCAT(cu.first_name, ' ', cu.last_name) AS registered_client_name,
      pp.id AS payment_plan_id,
      pp.total_amount AS plan_total,
      pp.frequency,
      pp.installment_count
    FROM agreements a
    INNER JOIN cases c ON c.id = a.case_id
    INNER JOIN case_types ct ON ct.id = c.case_type_id
    INNER JOIN users lu ON lu.id = a.lawyer_user_id
    INNER JOIN users cu ON cu.id = a.client_user_id
    LEFT JOIN payment_plans pp ON pp.agreement_id = a.id
    WHERE a.id = $1`,
    [agreementId]
  );

  if (result.rows.length === 0) {
    throw new ApiError(404, "Agreement not found");
  }

  const row = result.rows[0];

  if (role === "lawyer" && row.lawyer_user_id !== userId) {
    throw new ApiError(403, "Access denied");
  }
  if (role === "client" && row.client_user_id !== userId) {
    throw new ApiError(403, "Access denied");
  }

  const installmentsResult = await pool.query(
    `SELECT * FROM installments
     WHERE agreement_id = $1 AND installment_number >= 0
     ORDER BY installment_number ASC`,
    [agreementId]
  );

  const installments = installmentsResult.rows.map(mapInstallment);
  const totalAmountPaid = installments
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const remainingBalance = installments
    .filter((i) => i.status === "pending" || i.status === "overdue")
    .reduce((sum, i) => sum + i.amount, 0);

  return {
    agreement: {
      id: row.id,
      caseId: row.case_id,
      lawyerUserId: row.lawyer_user_id,
      clientUserId: row.client_user_id,
      lawyerBaseFee: parseFloat(row.lawyer_base_fee),
      agreedTotalAmount: parseFloat(row.agreed_total_amount),
      currency: row.currency,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    caseTitle: row.case_title,
    clientName: row.client_name || row.registered_client_name,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    caseCategory: row.case_category,
    caseTypeName: row.case_type_name,
    lawyerName: row.lawyer_name,
    paymentPlan: row.payment_plan_id
      ? {
          id: row.payment_plan_id,
          totalAmount: parseFloat(row.plan_total),
          frequency: row.frequency,
          installmentCount: row.installment_count,
        }
      : null,
    installments,
    totalAmountPaid: roundMoney(totalAmountPaid),
    remainingBalance: roundMoney(remainingBalance),
  };
}

export async function getAgreementsByCase(caseId, userId, role) {
  if (!isValidUuid(caseId)) {
    throw new ApiError(400, "Invalid case ID");
  }

  const caseCheck = await pool.query(
    `SELECT
      id,
      lawyer_user_id,
      client_user_id,
      client_email,
      client_name,
      title
    FROM cases WHERE id = $1`,
    [caseId]
  );
  if (caseCheck.rows.length === 0) {
    throw new ApiError(404, "Case not found");
  }

  const caseRow = caseCheck.rows[0];
  if (role === "lawyer" && caseRow.lawyer_user_id !== userId) {
    throw new ApiError(403, "Access denied");
  }
  if (role === "client") {
    const resolvedClientId =
      caseRow.client_user_id || (await resolveClientUserIdForCase(caseRow));
    const agreementAccess = await pool.query(
      `SELECT 1 FROM agreements
       WHERE case_id = $1 AND client_user_id = $2
       LIMIT 1`,
      [caseId, userId]
    );
    if (resolvedClientId !== userId && agreementAccess.rows.length === 0) {
      throw new ApiError(403, "Access denied");
    }
  }

  const agreements = await pool.query(
    `SELECT id FROM agreements WHERE case_id = $1 ORDER BY created_at DESC`,
    [caseId]
  );

  const snapshots = [];
  for (const row of agreements.rows) {
    snapshots.push(await getAgreementSnapshot(row.id, userId, role));
  }

  return snapshots;
}

export async function listClientAgreements(clientUserId) {
  const result = await pool.query(
    `SELECT id FROM agreements WHERE client_user_id = $1 ORDER BY created_at DESC`,
    [clientUserId]
  );

  const items = [];
  for (const row of result.rows) {
    items.push(await getAgreementSnapshot(row.id, clientUserId, "client"));
  }
  return items;
}

export async function updateAgreementStatus(agreementId, status) {
  const result = await pool.query(
    `UPDATE agreements
     SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [status, agreementId]
  );
  return result.rows[0];
}

export async function getInstallmentForCheckout(installmentId, userId, role) {
  if (!isValidUuid(installmentId)) {
    throw new ApiError(400, "Invalid installment ID");
  }

  const result = await pool.query(
    `SELECT
      i.*,
      a.case_id,
      a.client_user_id,
      a.lawyer_user_id,
      a.status AS agreement_status,
      c.title AS case_title,
      c.status AS case_status
    FROM installments i
    INNER JOIN agreements a ON a.id = i.agreement_id
    INNER JOIN cases c ON c.id = a.case_id
    WHERE i.id = $1`,
    [installmentId]
  );

  if (result.rows.length === 0) {
    throw new ApiError(404, "Installment not found");
  }

  const row = result.rows[0];

  if (role === "client" && row.client_user_id !== userId) {
    throw new ApiError(403, "Access denied");
  }

  if (role === "lawyer" && row.lawyer_user_id !== userId) {
    throw new ApiError(403, "Access denied");
  }

  return row;
}

// Legacy export for case auto-creation
export async function createAgreement(
  caseId,
  lawyerUserId,
  clientUserId,
  lawyerBaseFee,
  agreedTotalAmount,
  frequency,
  installmentCount
) {
  return createAgreementWithInstallments({
    caseId,
    lawyerUserId,
    clientUserId,
    lawyerBaseFee,
    agreedTotalAmount,
    frequency,
    installmentCount,
  });
}

export async function getAgreementById(agreementId) {
  const result = await pool.query(
    `SELECT
      a.*,
      pp.id AS payment_plan_id,
      pp.total_amount AS plan_total,
      pp.frequency,
      pp.installment_count
    FROM agreements a
    LEFT JOIN payment_plans pp ON a.id = pp.agreement_id
    WHERE a.id = $1`,
    [agreementId]
  );
  return result.rows[0] || null;
}

export async function getAgreementInstallments(agreementId) {
  const result = await pool.query(
    `SELECT * FROM installments WHERE agreement_id = $1 ORDER BY installment_number ASC`,
    [agreementId]
  );
  return result.rows;
}
