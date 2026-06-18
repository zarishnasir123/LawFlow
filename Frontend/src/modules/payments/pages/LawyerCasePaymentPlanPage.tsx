import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, HandCoins } from "lucide-react";
import LawyerLayout from "../../lawyer/components/LawyerLayout";
import ReceiptsList from "../components/ReceiptsList";
import TransactionHistoryList from "../components/TransactionHistoryList";
import PaymentPlanSetup from "../components/PaymentPlanSetup";
import LawyerInstallmentsTable from "../components/LawyerInstallmentsTable";
import PaymentSummaryCard from "../components/PaymentSummaryCard";
import {
  getAgreementsByCase,
  getLawyerCasePaymentContext,
  getPaymentReceipts,
  getPaymentTransactions,
} from "../api";
import { casesApi, type ApiCase } from "../../lawyer/api/cases.api";
import { formatCaseTitle } from "../utils/caseDisplay";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidCaseId(value?: string): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

export default function LawyerCasePaymentPlanPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { caseId?: string };

  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ["lawyer-cases"],
    queryFn: () => casesApi.listMyCases(),
    staleTime: 1000 * 60 * 5,
  });

  const selectedCaseId = useMemo(() => {
    if (isValidCaseId(params.caseId) && cases.some((c) => c.id === params.caseId)) {
      return params.caseId;
    }
    return cases[0]?.id;
  }, [cases, params.caseId]);

  useEffect(() => {
    if (casesLoading || cases.length === 0) return;
    const routeCaseInvalid =
      params.caseId && !cases.some((c) => c.id === params.caseId);
    if (routeCaseInvalid || !params.caseId) {
      navigate({
        to: "/lawyer-case-payments/$caseId",
        params: { caseId: cases[0].id },
        replace: true,
      });
    }
  }, [cases, casesLoading, navigate, params.caseId]);

  const selectedCase: ApiCase | undefined = cases.find((c) => c.id === selectedCaseId);

  const { data: paymentContext, isLoading: contextLoading } = useQuery({
    queryKey: ["lawyer-payment-context", selectedCaseId],
    queryFn: () => getLawyerCasePaymentContext(selectedCaseId!),
    enabled: isValidCaseId(selectedCaseId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: agreementsData = [], isLoading: agreementsLoading } = useQuery({
    queryKey: ["agreements", selectedCaseId],
    queryFn: () => getAgreementsByCase(selectedCaseId!),
    enabled: isValidCaseId(selectedCaseId),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 8000,
  });

  const snapshot = agreementsData[0] ?? null;

  const { data: apiTransactions = [] } = useQuery({
    queryKey: ["lawyer-transactions", selectedCaseId],
    queryFn: () => getPaymentTransactions(selectedCaseId!),
    enabled: isValidCaseId(selectedCaseId) && Boolean(snapshot),
    staleTime: 0,
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
  });

  const { data: apiReceipts = [] } = useQuery({
    queryKey: ["lawyer-receipts", selectedCaseId],
    queryFn: () => getPaymentReceipts(selectedCaseId!),
    enabled: isValidCaseId(selectedCaseId) && Boolean(snapshot),
    staleTime: 0,
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
  });

  const installmentLabelById = useMemo(() => {
    if (!snapshot) return {};
    return snapshot.installments.reduce<Record<string, string>>((acc, item) => {
      if (item.installmentNumber === 0) {
        acc[item.id] = "Service Charge";
      } else if (item.installmentNumber > 0) {
        acc[item.id] = `Installment #${item.installmentNumber}`;
      }
      return acc;
    }, {});
  }, [snapshot]);

  const caseDisplayTitle = useMemo(() => {
    if (snapshot) {
      return formatCaseTitle({
        caseTitle: snapshot.caseTitle,
        caseTypeName: snapshot.caseTypeName,
        clientName: snapshot.clientName,
      });
    }
    return selectedCase?.title || "";
  }, [snapshot, selectedCase?.title]);

  if (casesLoading) {
    return (
      <LawyerLayout brandTitle="LawFlow" brandSubtitle="Case Payment Plans">
        <div className="py-8 text-center text-gray-600">Loading…</div>
      </LawyerLayout>
    );
  }

  if (cases.length === 0) {
    return (
      <LawyerLayout brandTitle="LawFlow" brandSubtitle="Case Payment Plans">
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Briefcase className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <p className="text-base font-medium text-gray-800">No cases available.</p>
        </div>
      </LawyerLayout>
    );
  }

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle="Case Payment Plans">
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/30 to-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <HandCoins className="h-3.5 w-3.5" />
                Payment Planning
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-gray-900">Case Payment Plan</h1>
            </div>
            <select
              value={selectedCaseId || ""}
              onChange={(e) =>
                navigate({
                  to: "/lawyer-case-payments/$caseId",
                  params: { caseId: e.target.value },
                })
              }
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} — {c.clientName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {contextLoading || agreementsLoading ? (
          <p className="text-center text-sm text-gray-600">Loading payment plan…</p>
        ) : paymentContext && !snapshot ? (
          <PaymentPlanSetup caseId={selectedCaseId!} context={paymentContext} />
        ) : snapshot ? (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
              <p>
                <span className="text-gray-500">Client:</span>{" "}
                <span className="font-medium">{snapshot.clientName}</span>
              </p>
              <p className="mt-1">
                <span className="text-gray-500">Case:</span>{" "}
                <span className="font-medium">{caseDisplayTitle}</span>
              </p>
              <p className="mt-1">
                <span className="text-gray-500">Service Charge:</span>{" "}
                <span className="font-semibold text-[#01411C]">
                  PKR {snapshot.agreement.lawyerBaseFee.toLocaleString()}
                </span>
              </p>
            </div>

            <PaymentSummaryCard
              total={snapshot.agreement.agreedTotalAmount}
              paid={snapshot.totalAmountPaid}
              remaining={snapshot.remainingBalance}
            />

            <LawyerInstallmentsTable
              installments={snapshot.installments.filter(
                (i) => i.installmentNumber >= 0
              )}
            />

            <TransactionHistoryList
              transactions={apiTransactions.map(
                (txn: {
                  id: string;
                  installmentId: string;
                  amount: number;
                  status: string;
                  createdAt: string;
                }) => ({
                  id: txn.id,
                  installmentId: txn.installmentId,
                  amount: txn.amount,
                  status: txn.status === "success" ? "success" : "failed",
                  createdAt: txn.createdAt,
                  method: "card" as const,
                  provider: "safepay" as const,
                  caseId: selectedCaseId!,
                  planId: snapshot.agreement.id,
                })
              )}
              installmentLabelById={installmentLabelById}
            />

            <ReceiptsList
              receipts={apiReceipts.map(
                (r: {
                  id: string;
                  receiptNumber: string;
                  installmentId: string;
                  amount: number;
                  issuedAt: string;
                  transactionId?: string;
                  clientName?: string;
                  lawyerName?: string;
                  caseTitle?: string;
                  paymentStatus?: string;
                }) => ({
                  id: r.id,
                  receiptNo: r.receiptNumber,
                  installmentId: r.installmentId,
                  amount: r.amount,
                  issuedAt: r.issuedAt,
                  method: "safepay" as const,
                  caseId: selectedCaseId!,
                  planId: snapshot.agreement.id,
                  transactionId: r.transactionId,
                  clientName: r.clientName,
                  lawyerName: r.lawyerName,
                  caseTitle: r.caseTitle,
                  paymentStatus: r.paymentStatus,
                })
              )}
              installmentLabelById={installmentLabelById}
              caseDisplayTitle={caseDisplayTitle}
              caseTypeName={snapshot.caseTypeName}
              agreedTotal={snapshot.agreement.agreedTotalAmount}
              totalPaid={snapshot.totalAmountPaid}
            />
          </>
        ) : null}
      </div>
    </LawyerLayout>
  );
}
