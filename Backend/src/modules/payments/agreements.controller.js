import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import {
  createAgreementWithInstallments,
  createPaymentPlanForCase,
  getAgreementSnapshot,
  getAgreementsByCase,
  getCaseForAgreement,
  listClientAgreements,
  listLawyerAgreementCases,
  updateAgreementStatus,
} from "./agreements.service.js";
import {
  listReceiptsForUser,
  listTransactionsForUser,
  getReceiptById,
  listLawyerEarnings,
} from "./transactions.service.js";
import {
  getCategoryFeeForCase,
  getServiceChargesByLawyerId,
  mapServiceChargesRow,
} from "./serviceCharges.service.js";
import {
  getLawyerPayoutAccount,
  upsertLawyerPayoutAccount,
} from "./payouts.service.js";

function mapAgreementResponse(snapshot) {
  return {
    agreement: snapshot.agreement,
    caseTitle: snapshot.caseTitle,
    clientName: snapshot.clientName,
    clientEmail: snapshot.clientEmail,
    clientPhone: snapshot.clientPhone,
    caseCategory: snapshot.caseCategory,
    caseTypeName: snapshot.caseTypeName,
    lawyerName: snapshot.lawyerName,
    paymentPlan: snapshot.paymentPlan,
    installments: snapshot.installments,
    totalAmountPaid: snapshot.totalAmountPaid,
    remainingBalance: snapshot.remainingBalance,
  };
}

export async function createAgreementHandler(req, res) {
  const {
    caseId,
    clientUserId,
    agreedTotalAmount,
    frequency,
    installmentCount,
    installments,
  } = req.body;
  const lawyerUserId = req.user.sub;

  try {
    const serviceCharges = await getServiceChargesByLawyerId(lawyerUserId);
    const lawyerBaseFee = serviceCharges?.base_fee
      ? parseFloat(serviceCharges.base_fee)
      : 0;

    if (!serviceCharges || lawyerBaseFee <= 0) {
      return res.status(400).json({
        message:
          "You must set your service charges before creating an agreement.",
      });
    }

    const result = await createAgreementWithInstallments({
      caseId,
      lawyerUserId,
      clientUserId,
      lawyerBaseFee,
      agreedTotalAmount,
      frequency,
      installmentCount,
      installments,
    });

    const snapshot = await getAgreementSnapshot(
      result.agreement.id,
      lawyerUserId,
      "lawyer"
    );

    return res.status(201).json({
      message: "Agreement created successfully",
      data: mapAgreementResponse(snapshot),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error creating agreement:", error);
    return res.status(500).json({ message: "Failed to create agreement" });
  }
}

export async function getAgreementHandler(req, res) {
  const { agreementId } = req.params;

  try {
    const snapshot = await getAgreementSnapshot(
      agreementId,
      req.user.sub,
      req.user.role
    );

    return res.status(200).json({
      data: mapAgreementResponse(snapshot),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error fetching agreement:", error);
    return res.status(500).json({ message: "Failed to fetch agreement" });
  }
}

export async function getAgreementsByCaseHandler(req, res) {
  const { caseId } = req.params;

  try {
    const snapshots = await getAgreementsByCase(
      caseId,
      req.user.sub,
      req.user.role
    );

    return res.status(200).json({
      data: snapshots.map(mapAgreementResponse),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error fetching agreements:", error);
    return res.status(500).json({ message: "Failed to fetch agreements" });
  }
}

export async function listLawyerAgreementCasesHandler(req, res) {
  try {
    const cases = await listLawyerAgreementCases(req.user.sub);
    return res.status(200).json({ data: cases });
  } catch (error) {
    console.error("Error listing agreement cases:", error);
    return res.status(500).json({ message: "Failed to fetch cases" });
  }
}

export async function createPaymentPlanHandler(req, res) {
  const { caseId } = req.params;
  const { totalAmount, installmentCount } = req.body;
  const lawyerUserId = req.user.sub;

  try {
    const result = await createPaymentPlanForCase({
      caseId,
      lawyerUserId,
      totalAmount,
      installmentCount,
    });

    const snapshot = await getAgreementSnapshot(
      result.agreement.id,
      lawyerUserId,
      "lawyer"
    );

    return res.status(201).json({
      message: "Payment plan created successfully",
      data: mapAgreementResponse(snapshot),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error creating payment plan:", error);
    return res.status(500).json({ message: "Failed to create payment plan" });
  }
}

export async function getLawyerCaseAgreementContextHandler(req, res) {
  const { caseId } = req.params;

  try {
    const caseInfo = await getCaseForAgreement({
      caseId,
      lawyerUserId: req.user.sub,
    });

    const chargesRow = await getServiceChargesByLawyerId(req.user.sub);
    const charges = mapServiceChargesRow(chargesRow);
    const category = String(caseInfo.caseCategory || "").toLowerCase();
    const categoryFee = await getCategoryFeeForCase(req.user.sub, category);

    const existingResult = await pool.query(
      "SELECT id FROM agreements WHERE case_id = $1 LIMIT 1",
      [caseId]
    );
    const existing = existingResult.rows.length > 0;

    return res.status(200).json({
      data: {
        case: caseInfo,
        caseCategory: caseInfo.caseCategory,
        categoryFee,
        hasCategoryFee: categoryFee > 0,
        familyCaseFee: charges?.familyCaseFee ?? null,
        civilCaseFee: charges?.civilCaseFee ?? null,
        hasPaymentPlan: existing,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error fetching case agreement context:", error);
    return res.status(500).json({ message: "Failed to fetch case details" });
  }
}

export async function listClientAgreementsHandler(req, res) {
  try {
    const items = await listClientAgreements(req.user.sub);
    return res.status(200).json({
      data: items.map(mapAgreementResponse),
    });
  } catch (error) {
    console.error("Error listing client agreements:", error);
    return res.status(500).json({ message: "Failed to fetch agreements" });
  }
}

export async function listTransactionsHandler(req, res) {
  const { caseId } = req.query;

  try {
    const transactions = await listTransactionsForUser({
      userId: req.user.sub,
      role: req.user.role,
      caseId: caseId || undefined,
    });

    return res.status(200).json({ data: transactions });
  } catch (error) {
    console.error("Error listing transactions:", error);
    return res.status(500).json({ message: "Failed to fetch transactions" });
  }
}

export async function listReceiptsHandler(req, res) {
  const { caseId } = req.query;

  try {
    const receipts = await listReceiptsForUser({
      userId: req.user.sub,
      role: req.user.role,
      caseId: caseId || undefined,
    });

    return res.status(200).json({ data: receipts });
  } catch (error) {
    console.error("Error listing receipts:", error);
    return res.status(500).json({ message: "Failed to fetch receipts" });
  }
}

export async function listLawyerEarningsHandler(req, res) {
  try {
    const earnings = await listLawyerEarnings(req.user.sub);
    return res.status(200).json({ data: earnings });
  } catch (error) {
    console.error("Error listing lawyer earnings:", error);
    return res.status(500).json({ message: "Failed to fetch earnings" });
  }
}

export async function getLawyerPayoutAccountHandler(req, res) {
  try {
    const account = await getLawyerPayoutAccount(req.user.sub);
    return res.status(200).json({ data: account });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error fetching payout account:", error);
    return res.status(500).json({ message: "Failed to fetch payout account" });
  }
}

export async function updateLawyerPayoutAccountHandler(req, res) {
  const { accountTitle, accountNumber, bankName } = req.body;
  try {
    const account = await upsertLawyerPayoutAccount(req.user.sub, {
      accountTitle,
      accountNumber,
      bankName,
    });
    return res.status(200).json({ message: "Payout account saved", data: account });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error saving payout account:", error);
    return res.status(500).json({ message: "Failed to save payout account" });
  }
}

export async function getReceiptHandler(req, res) {
  const { receiptId } = req.params;

  try {
    const receipt = await getReceiptById(
      receiptId,
      req.user.sub,
      req.user.role
    );

    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    return res.status(200).json({ data: receipt });
  } catch (error) {
    console.error("Error fetching receipt:", error);
    return res.status(500).json({ message: "Failed to fetch receipt" });
  }
}

export async function updateAgreementStatusHandler(req, res) {
  const { agreementId } = req.params;
  const { status } = req.body;

  try {
    const snapshot = await getAgreementSnapshot(
      agreementId,
      req.user.sub,
      req.user.role
    );

    if (req.user.role === "lawyer" && snapshot.agreement.lawyerUserId !== req.user.sub) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updated = await updateAgreementStatus(agreementId, status);
    return res.status(200).json({
      message: "Agreement updated successfully",
      data: {
        id: updated.id,
        status: updated.status,
        updatedAt: updated.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error updating agreement:", error);
    return res.status(500).json({ message: "Failed to update agreement" });
  }
}
