import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import ClientLayout from "../../client/components/ClientLayout";
import ClientInstallmentsTable from "../components/ClientInstallmentsTable";
import PaymentSummaryCard from "../components/PaymentSummaryCard";
import ReceiptsList from "../components/ReceiptsList";
import TransactionHistoryList from "../components/TransactionHistoryList";
import {
  confirmPayment,
  getAgreementsByCase,
  getClientAgreements,
  getPaymentReceipts,
  getPaymentTransactions,
  type AgreementSnapshotData,
} from "../api";
import { formatCaseSelectLabel, formatCaseTitle } from "../utils/caseDisplay";
import { mapApiInstallments } from "../utils/mapInstallments";

export default function ClientCasePaymentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams({ strict: false }) as { caseId?: string };

  const selectedCaseId = params.caseId;

  const isValidCaseId = (value?: string) =>
    Boolean(
      value &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          value
        )
    );

  const { data: allAgreements = [], isLoading: allLoading } = useQuery({
    queryKey: ["client-all-agreements"],
    queryFn: getClientAgreements,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: caseAgreements = [], isLoading: caseLoading } = useQuery({
    queryKey: ["client-case-agreements", selectedCaseId],
    queryFn: () => getAgreementsByCase(selectedCaseId!),
    enabled: isValidCaseId(selectedCaseId),
    staleTime: 0,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  const snapshot = useMemo((): AgreementSnapshotData | null => {
    if (isValidCaseId(selectedCaseId)) {
      if (caseAgreements[0]) return caseAgreements[0];
      return (
        allAgreements.find((a) => a.agreement.caseId === selectedCaseId) ?? null
      );
    }
    if (!selectedCaseId) return allAgreements[0] || null;
    return null;
  }, [allAgreements, caseAgreements, selectedCaseId]);

  const caseDisplayTitle = useMemo(() => {
    if (!snapshot) return "";
    return formatCaseTitle({
      caseTitle: snapshot.caseTitle,
      caseTypeName: snapshot.caseTypeName,
      clientName: snapshot.clientName,
    });
  }, [snapshot]);

  const activeCaseId =
    snapshot?.agreement.caseId ||
    (isValidCaseId(selectedCaseId) ? selectedCaseId : undefined);

  const clientInstallments = useMemo(
    () => (snapshot ? mapApiInstallments(snapshot) : []),
    [snapshot]
  );

  const { data: transactions = [] } = useQuery({
    queryKey: ["client-transactions", activeCaseId],
    queryFn: () => getPaymentTransactions(activeCaseId!),
    enabled: Boolean(activeCaseId),
    staleTime: 0,
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ["client-receipts", activeCaseId],
    queryFn: () => getPaymentReceipts(activeCaseId!),
    enabled: Boolean(activeCaseId),
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

  const [feedback, setFeedback] = useState<
    { text: string; tone: "success" | "info" } | null
  >(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    // Safepay's hosted checkout returns with `order_id` (our installment id);
    // the older signed flow used tracker + sig. `payment` is our own legacy flag.
    const orderId = search.get("order_id");
    const tracker = search.get("tracker");
    const reference = search.get("reference");
    const outcome = search.get("payment");
    if (!orderId && !tracker && !outcome) return;

    let cancelled = false;

    const refreshPaymentData = async (caseId?: string) => {
      await queryClient.refetchQueries({ queryKey: ["client-all-agreements"] });
      if (caseId) {
        await queryClient.refetchQueries({
          queryKey: ["client-case-agreements", caseId],
        });
        await queryClient.refetchQueries({
          queryKey: ["client-transactions", caseId],
        });
        await queryClient.refetchQueries({
          queryKey: ["client-receipts", caseId],
        });
      }
    };

    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    (async () => {
      if (outcome === "cancel") {
        setFeedback({
          text: "Payment was cancelled. You can try again whenever you're ready.",
          tone: "info",
        });
      } else if (outcome === "failed") {
        setFeedback({
          text: "We couldn't confirm your payment. If any amount was deducted, it will reflect shortly.",
          tone: "info",
        });
      } else if (orderId || tracker) {
        // Confirm with the backend, which asks Safepay (server-to-server)
        // whether the payment truly completed, then records it. Retry a few
        // times in case Safepay is still settling when we land back.
        setConfirmingPayment(true);
        const payload = orderId
          ? { orderId }
          : { tracker: tracker ?? undefined, reference };
        let recorded = false;
        for (let attempt = 0; attempt < 4 && !cancelled; attempt += 1) {
          try {
            const result = await confirmPayment(payload);
            if (result.recorded || result.duplicate) {
              recorded = true;
              break;
            }
          } catch {
            // network hiccup — fall through to retry
          }
          await sleep(2000);
        }
        setFeedback(
          recorded
            ? {
                text: "Payment successful. Your receipt is available below.",
                tone: "success",
              }
            : {
                text: "We're still confirming your payment. If any amount was deducted, it will reflect here shortly.",
                tone: "info",
              }
        );
        await refreshPaymentData(activeCaseId || selectedCaseId);
        if (!cancelled) setConfirmingPayment(false);
      } else if (outcome === "success") {
        // Legacy backend-return path (still supported): already recorded server-side.
        setConfirmingPayment(true);
        setFeedback({
          text: "Payment successful. Your receipt is available below.",
          tone: "success",
        });
        await refreshPaymentData(activeCaseId || selectedCaseId);
        if (!cancelled) setConfirmingPayment(false);
      }
      const url = new URL(window.location.href);
      ["payment", "session_id", "order_id", "tracker", "sig", "reference"].forEach(
        (key) => url.searchParams.delete(key)
      );
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCaseId, queryClient, selectedCaseId]);

  const isLoading = allLoading || (Boolean(selectedCaseId) && caseLoading);

  if (isLoading) {
    return (
      <ClientLayout brandSubtitle="Case Payments">
        <div className="py-8 text-center text-gray-600">Loading payment information…</div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout brandSubtitle="Case Payments">
      <div className="space-y-6">
        {/* Green header band — same language as the receipt header */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="bg-[#01411C] px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold tracking-wide text-white">
                  Case Payments
                </h1>
                <p className="mt-1 text-sm text-emerald-50/90">
                  Pay your installments and access receipts — collected securely
                  by LawFlow.
                </p>
              </div>
              {allAgreements.length >= 1 && (
                <select
                  value={activeCaseId || ""}
                  onChange={(event) =>
                    navigate({ to: `/client-payments/${event.target.value}` })
                  }
                  className="rounded-lg border border-white/30 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/40"
                >
                  {allAgreements.map((item) => (
                    <option key={item.agreement.caseId} value={item.agreement.caseId}>
                      {formatCaseSelectLabel({
                        caseTitle: item.caseTitle,
                        caseTypeName: item.caseTypeName,
                        clientName: item.clientName,
                      })}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {confirmingPayment && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Recording your payment…
          </div>
        )}

        {feedback && !confirmingPayment && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              feedback.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            <div className="flex items-start gap-2">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{feedback.text}</span>
            </div>
          </div>
        )}

        {!snapshot ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-base font-medium text-gray-800">
              {allAgreements.length === 0
                ? "No payment plans are available yet."
                : "No payment plan is available for this case yet."}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Your lawyer will create an installment schedule. Check back once it is ready.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-emerald-100 bg-[#f4fbf7] p-4 text-sm text-emerald-900">
              <div className="flex items-start gap-2">
                <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <span>
                  You're paying <span className="font-semibold">LawFlow</span> for
                  your case with <span className="font-semibold">{snapshot.lawyerName}</span>.
                  LawFlow securely collects this payment and settles your lawyer's
                  share.
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Case Information
              </p>
              <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-gray-400">Case Title</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{caseDisplayTitle}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Case Type</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">
                    {snapshot.caseTypeName || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Lawyer</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{snapshot.lawyerName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Service Charge</dt>
                  <dd className="mt-0.5 font-semibold text-[#01411C]">
                    PKR {snapshot.agreement.lawyerBaseFee.toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>

            <PaymentSummaryCard
              total={snapshot.agreement.agreedTotalAmount}
              paid={snapshot.totalAmountPaid}
              remaining={snapshot.remainingBalance}
            />

            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Installments
              </p>
              <ClientInstallmentsTable
                installments={clientInstallments}
                caseName={caseDisplayTitle}
              />
            </div>

            <TransactionHistoryList
              transactions={transactions.map((txn: {
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
                method: "card",
                provider: "safepay",
                caseId: activeCaseId || "",
                planId: snapshot.agreement.id,
              }))}
              installmentLabelById={installmentLabelById}
            />

            <ReceiptsList
              receipts={receipts.map((r: {
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
                method: "safepay",
                caseId: activeCaseId || "",
                planId: snapshot.agreement.id,
                transactionId: r.transactionId,
                clientName: r.clientName,
                lawyerName: r.lawyerName,
                caseTitle: r.caseTitle,
                paymentStatus: r.paymentStatus,
              }))}
              installmentLabelById={installmentLabelById}
              caseDisplayTitle={caseDisplayTitle}
              caseTypeName={snapshot.caseTypeName}
              agreedTotal={snapshot.agreement.agreedTotalAmount}
              totalPaid={snapshot.totalAmountPaid}
            />
          </>
        )}
      </div>
    </ClientLayout>
  );
}
