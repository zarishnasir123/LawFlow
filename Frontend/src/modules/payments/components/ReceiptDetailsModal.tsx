import type { Receipt } from "../types/payments";
import { formatCurrency } from "../utils/paymentCalculations";
import { useRef } from "react";

type ReceiptDetailsModalProps = {
  receipt: Receipt;
  caseDisplayTitle: string;
  installmentLabel: string;
  onClose: () => void;
};

const formatReceiptNo = (value?: string) => {
  if (!value) return "RC-2026-000000";
  if (value.startsWith("RC-")) return value;
  return `RC-${value.slice(-6).toUpperCase()}`;
};

const formatTransactionNo = (value?: string) => {
  if (!value) return "TXN-2026-000000";
  if (value.startsWith("TXN-")) return value;
  return `TXN-${value.slice(-6).toUpperCase()}`;
};

export default function ReceiptDetailsModal({
  receipt,
  caseDisplayTitle,
  installmentLabel,
  onClose,
}: ReceiptDetailsModalProps) {
  // Receipt portion ko target karne ke liye ref
  const receiptRef = useRef<HTMLDivElement>(null);

  // PDF Download handle karne ka clean function
  const handleDownloadPDF = () => {
    if (!receiptRef.current) return;
    
    const printContent = receiptRef.current.innerHTML;
    const originalContent = document.body.innerHTML;

    // Sirf receipt card ko window print frame mein load karna
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: system-ui, sans-serif; max-width: 650px; margin: 0 auto;">
        ${printContent}
      </div>
    `;
    
    // Browser ka download/save as PDF dialog open hoga
    window.print();
    
    // Web app ka original UI aur state wapis restore karna
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-hidden border border-gray-100">

        {/* PRINTABLE AREA CONTAINER */}
        <div ref={receiptRef}>
          {/* HEADER - LawFlow Deep Green `#04341e` */}
          <div className="bg-[#04341e] px-6 py-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400 print:text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                  <h2 className="text-lg font-semibold tracking-wide">Payment Receipt</h2>
                </div>
                <p className="text-xs text-gray-300/90 mt-0.5">
                  LawFlow Official Payment Confirmation
                </p>
              </div>

              {/* Close Button - Jo PDF me hidden rahega */}
              <button
                onClick={onClose}
                className="text-xs font-medium bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition print:hidden"
              >
                Close
              </button>
            </div>
          </div>

          {/* BODY */}
          <div className="p-6 space-y-5 bg-gray-50/50">
            
            {/* RECEIPT & TXN NUMBERS */}
            <div className="grid grid-cols-2 gap-4 bg-white border border-gray-200/60 rounded-xl p-4 shadow-sm">
              <div>
                <p className="text-xs text-gray-500 font-medium">Receipt Number</p>
                <p className="font-semibold text-gray-800 mt-0.5">
                  {formatReceiptNo(receipt.receiptNo)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Transaction Number</p>
                <p className="font-semibold text-gray-800 mt-0.5">
                  {formatTransactionNo(receipt.transactionId)}
                </p>
              </div>
            </div>

            {/* CASE INFORMATION PANEL */}
            <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Case Information</p>
                <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200">
                  {installmentLabel}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400">Case Title</p>
                  <p className="font-semibold text-gray-800 mt-0.5 capitalize">{caseDisplayTitle}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Case Type</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">Suit for Permanent Injunction</p>
                </div>
              </div>
            </div>

            {/* CLIENT & LAWYER INFORMATION */}
            <div className="grid grid-cols-2 gap-4">
              {receipt.clientName && (
                <div className="bg-white border border-gray-200/60 rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-gray-400">Client Name</p>
                  <p className="font-semibold text-gray-800 mt-0.5 capitalize">
                    {receipt.clientName}
                  </p>
                </div>
              )}
              {receipt.lawyerName && (
                <div className="bg-white border border-gray-200/60 rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-gray-400">Lawyer Assigned</p>
                  <p className="font-semibold text-gray-800 mt-0.5 capitalize">
                    {receipt.lawyerName}
                  </p>
                </div>
              )}
            </div>

            {/* AMOUNT SUMMARY - LawFlow Mint Green style badge */}
            <div className="rounded-xl border border-emerald-100 bg-[#f4fbf7] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Amount Paid</p>
                  <p className="text-2xl font-bold text-[#04341e] mt-0.5">
                    {formatCurrency(receipt.amount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 font-medium mb-1">Status</p>
                  <span className="inline-flex items-center text-xs font-semibold bg-[#dcfae6] text-[#04341e] px-3 py-1 rounded-full border border-[#bbf7cd]">
                    {receipt.paymentStatus || "PAID"}
                  </span>
                </div>
              </div>
            </div>

            {/* FOOTER METADATA */}
            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
              <div>
                <span className="font-medium text-gray-400">Issued On: </span>
                {new Date(receipt.issuedAt).toLocaleString()}
              </div>
              <div className="font-medium text-gray-400">LawFlow Secure Gateway</div>
            </div>

          </div>
        </div>

        {/* BOTTOM ACTION BUTTONS - Yeh download hone wale PDF me automatically hidden ho jayenge */}
        <div className="p-6 pt-0 bg-gray-50/50 flex gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex-1 bg-[#04341e] text-white text-sm font-medium py-2.5 rounded-xl hover:bg-[#032515] shadow-sm transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Receipt
          </button>

          <button
            onClick={handleDownloadPDF}
            className="flex-1 border border-gray-300 bg-white text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 shadow-sm transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PDF
          </button>
        </div>

      </div>
    </div>
  );
}