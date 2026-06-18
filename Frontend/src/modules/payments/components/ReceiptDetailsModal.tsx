import { useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import type { Receipt } from "../types/payments";

type ReceiptDetailsModalProps = {
  receipt: Receipt;
  caseDisplayTitle: string;
  installmentLabel: string;
  caseTypeName?: string;
  agreedTotal?: number;
  totalPaid?: number;
  onClose: () => void;
};

const BRAND = "#01411c";

// Escape user-supplied text before it goes into the receipt HTML, so a stray
// "<" in a name/title can't break the layout (and never injects markup into the
// print window).
const esc = (value?: string | null) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      (({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }) as Record<string, string>)[c]
  );

const money = (n?: number) => `Rs ${Number(n ?? 0).toLocaleString()}`;

const formatReceiptNo = (value?: string) => {
  if (!value) return "RC-2026-000000";
  if (value.startsWith("RC-")) return value;
  return `RC-${value.slice(-6).toUpperCase()}`;
};

// Real transaction id only — we don't fabricate one. The row is hidden when the
// payment has no gateway transaction recorded.
const formatTxnNo = (value?: string) => {
  if (!value) return null;
  if (value.startsWith("TXN-")) return value;
  return `TXN-${value.slice(-8).toUpperCase()}`;
};

// The whole receipt as one self-contained, inline-styled HTML block. Rendering
// the SAME markup on screen and in the print window keeps the downloaded PDF
// pixel-identical to the preview, with no dependency on the app's CSS.
function buildReceiptHtml(args: {
  receiptNo: string;
  txnNo: string | null;
  dateLabel: string;
  status: string;
  clientName?: string;
  lawyerName?: string;
  caseTitle: string;
  caseTypeName?: string;
  installmentLabel: string;
  amount: number;
  agreedTotal?: number;
  totalPaid?: number;
}) {
  const {
    receiptNo,
    txnNo,
    dateLabel,
    status,
    clientName,
    lawyerName,
    caseTitle,
    caseTypeName,
    installmentLabel,
    amount,
    agreedTotal,
    totalPaid,
  } = args;

  const showBalance = typeof agreedTotal === "number" && agreedTotal > 0;
  const due = showBalance
    ? Math.max(0, (agreedTotal || 0) - (totalPaid || 0))
    : 0;

  const balanceBlock = showBalance
    ? `
    <div style="padding:18px 26px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:#f4fbf7;border:1px solid #cfe9d9;border-radius:10px;">
        <tr>
          <td style="padding:14px;text-align:center;border-right:1px solid #e2efe8;">
            <div style="font-size:10px;color:#667085;text-transform:uppercase;letter-spacing:1px;">Agreed Total</div>
            <div style="font-size:16px;font-weight:700;color:#172033;margin-top:4px;">${money(agreedTotal)}</div>
          </td>
          <td style="padding:14px;text-align:center;border-right:1px solid #e2efe8;">
            <div style="font-size:10px;color:#667085;text-transform:uppercase;letter-spacing:1px;">Paid To Date</div>
            <div style="font-size:16px;font-weight:700;color:#067647;margin-top:4px;">${money(totalPaid)}</div>
          </td>
          <td style="padding:14px;text-align:center;">
            <div style="font-size:10px;color:#667085;text-transform:uppercase;letter-spacing:1px;">Remaining</div>
            <div style="font-size:16px;font-weight:700;color:#172033;margin-top:4px;">${money(due)}</div>
          </td>
        </tr>
      </table>
    </div>`
    : "";

  return `
  <div style="max-width:720px;margin:0 auto;background:#ffffff;color:#172033;font-family:Arial,Helvetica,sans-serif;border:1px solid #e4e7ec;border-radius:14px;overflow:hidden;">

    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="background:${BRAND};padding:22px 26px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:.5px;">LawFlow</div>
                <div style="color:#cfe9d9;font-size:11px;margin-top:2px;">Smart Case Filing System</div>
              </td>
              <td style="vertical-align:middle;text-align:right;">
                <div style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:2px;">PAYMENT RECEIPT</div>
                <div style="color:#cfe9d9;font-size:12px;margin-top:5px;">${esc(receiptNo)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Meta: billed to + details -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="width:55%;padding:22px 26px 6px;vertical-align:top;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#667085;margin-bottom:6px;">Billed To</div>
          <div style="font-size:15px;font-weight:700;color:#172033;">${esc(clientName) || "—"}</div>
          <div style="font-size:12px;color:#475467;margin-top:10px;">Advocate: <strong>${esc(lawyerName) || "—"}</strong></div>
          <div style="font-size:12px;color:#475467;margin-top:2px;">Collected by: <strong>LawFlow</strong></div>
        </td>
        <td style="width:45%;padding:22px 26px 6px;vertical-align:top;text-align:right;">
          <div style="font-size:12px;color:#475467;">Date: <strong>${esc(dateLabel)}</strong></div>
          ${
            txnNo
              ? `<div style="font-size:12px;color:#475467;margin-top:4px;">Transaction: <strong>${esc(txnNo)}</strong></div>`
              : ""
          }
          <div style="margin-top:10px;">
            <span style="display:inline-block;background:#dcfae6;color:#067647;border:1px solid #abefc6;border-radius:999px;padding:3px 12px;font-size:12px;font-weight:700;">${esc(status)}</span>
          </div>
        </td>
      </tr>
    </table>

    ${balanceBlock}

    <!-- Items -->
    <div style="padding:18px 26px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e4e7ec;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:${BRAND};">
            <th style="text-align:left;padding:10px 14px;color:#ffffff;font-size:11px;letter-spacing:.5px;width:40px;">#</th>
            <th style="text-align:left;padding:10px 14px;color:#ffffff;font-size:11px;letter-spacing:.5px;">Description</th>
            <th style="text-align:right;padding:10px 14px;color:#ffffff;font-size:11px;letter-spacing:.5px;width:150px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:14px;border-top:1px solid #eef0f3;font-size:13px;color:#475467;vertical-align:top;">1</td>
            <td style="padding:14px;border-top:1px solid #eef0f3;font-size:13px;color:#172033;vertical-align:top;">
              <div style="font-weight:600;">${esc(installmentLabel)} &mdash; ${esc(caseTitle)}</div>
              ${
                caseTypeName
                  ? `<div style="color:#667085;font-size:12px;margin-top:3px;">${esc(caseTypeName)}</div>`
                  : ""
              }
            </td>
            <td style="padding:14px;border-top:1px solid #eef0f3;font-size:13px;text-align:right;color:#172033;font-weight:600;vertical-align:top;">${money(amount)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Totals -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:14px;">
        <tr>
          <td style="padding:4px 14px;text-align:right;font-size:13px;color:#475467;">Subtotal</td>
          <td style="padding:4px 14px;text-align:right;font-size:13px;color:#172033;width:150px;">${money(amount)}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;text-align:right;font-size:14px;font-weight:700;color:#172033;border-top:2px solid ${BRAND};">Total Paid</td>
          <td style="padding:10px 14px;text-align:right;font-size:16px;font-weight:800;color:${BRAND};border-top:2px solid ${BRAND};width:150px;">${money(amount)}</td>
        </tr>
      </table>
    </div>

    <!-- Payment info -->
    <div style="padding:6px 26px 18px;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#667085;margin-bottom:6px;">Payment Information</div>
      <div style="font-size:12px;color:#475467;line-height:1.7;">
        Method: <strong>Safepay (Online)</strong><br/>
        Reference: <strong>${esc(txnNo || receiptNo)}</strong>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fbf9;border-top:1px solid #e2f0e8;padding:16px 26px;color:#5f6f66;font-size:11px;line-height:1.6;">
      This is a computer-generated payment receipt issued by LawFlow &mdash; no signature required. Payments are collected securely by LawFlow for your case; your lawyer receives their share afterwards. Please retain this receipt for your records.
    </div>
  </div>`;
}

export default function ReceiptDetailsModal({
  receipt,
  caseDisplayTitle,
  installmentLabel,
  caseTypeName,
  agreedTotal,
  totalPaid,
  onClose,
}: ReceiptDetailsModalProps) {
  const receiptNo = formatReceiptNo(receipt.receiptNo);
  const inner = buildReceiptHtml({
    receiptNo,
    txnNo: formatTxnNo(receipt.transactionId),
    dateLabel: new Date(receipt.issuedAt).toLocaleString(),
    status: (receipt.paymentStatus || "PAID").toUpperCase(),
    clientName: receipt.clientName,
    lawyerName: receipt.lawyerName,
    caseTitle: receipt.caseTitle || caseDisplayTitle,
    caseTypeName,
    installmentLabel,
    amount: receipt.amount,
    agreedTotal,
    totalPaid,
  });

  const [downloading, setDownloading] = useState(false);

  // Direct PDF download — no print dialog. Renders the same receipt markup into
  // an off-screen 720px container, snapshots it with html2canvas, and saves it
  // as a single-page PDF straight to the user's Downloads. (html2canvas +
  // jsPDF are already used elsewhere in the app.)
  const handleDownloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    const holder = document.createElement("div");
    holder.style.position = "fixed";
    holder.style.left = "-10000px";
    holder.style.top = "0";
    holder.style.width = "720px";
    holder.style.background = "#ffffff";
    holder.innerHTML = inner;
    document.body.appendChild(holder);
    try {
      // High scale → crisp text in the PDF (not soft/pixelated).
      const canvas = await html2canvas(holder, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");

      // Lay the snapshot onto a standard A4 portrait page (like the printed
      // version): full width with a small margin, scaled to fit one page and
      // centred — so the downloaded file looks like a proper document page.
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 28;
      let imgW = pageW - margin * 2;
      let imgH = (canvas.height * imgW) / canvas.width;
      const maxH = pageH - margin * 2;
      if (imgH > maxH) {
        imgH = maxH;
        imgW = (canvas.width * imgH) / canvas.height;
      }
      const x = (pageW - imgW) / 2;
      pdf.addImage(imgData, "PNG", x, margin, imgW, imgH);
      pdf.save(`receipt-${receiptNo}.pdf`);
    } catch (err) {
      console.error("Receipt PDF download failed:", err);
    } finally {
      document.body.removeChild(holder);
      setDownloading(false);
    }
  };

  // Secondary option: open a clean print window with the same receipt markup and
  // auto-print it (the browser's print dialog also has "Save as PDF").
  const handlePrint = () => {
    const win = window.open("", "_blank", "width=820,height=1040");
    if (!win) return; // popup blocked — user can retry
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8" />` +
        `<title>Receipt ${esc(receiptNo)}</title></head>` +
        `<body style="margin:0;background:#ffffff;padding:16px;">${inner}` +
        `<script>window.onload=function(){setTimeout(function(){window.print();},150);};</script>` +
        `</body></html>`
    );
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-800">Payment Receipt</h2>
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-200"
          >
            Close
          </button>
        </div>

        {/* Preview (identical to the printed PDF) */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
          <div dangerouslySetInnerHTML={{ __html: inner }} />
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-gray-100 p-4">
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#01411c] py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#032515] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Preparing PDF…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PDF
              </>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
