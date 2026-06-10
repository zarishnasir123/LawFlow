// import React, { useMemo, useState } from "react";
// import axios from "axios";
// import {
//   Calendar,
//   CreditCard,
//   FileText,
//   Scale,
//   ShieldCheck,
//   User,
//   Briefcase,
// } from "lucide-react";
// import { createCheckoutSession } from "../api";

// interface Installment {
//   id: string;
//   installmentNumber: number;
//   amount: number;
//   dueDate: string | null;
//   status: "pending" | "paid" | "overdue" | "cancelled";
//   paidAt?: string | null;
// }

// interface AgreementSnapshotProps {
//   caseName: string;
//   clientName: string;
//   lawyerName: string;
//   lawyerBaseFee: number;
//   agreedTotalAmount: number;
//   totalAmountPaid?: number;
//   createdAt: string;
//   currency: string;
//   installments: Installment[];
//   agreementId: string;
//   agreementStatus?: string;
//   showPayNow?: boolean;
// }

// const PROGRESS_MARKERS = [0, 25, 50, 75, 100];

// function checkoutErrorMessage(err: unknown): string {
//   if (axios.isAxiosError(err)) {
//     const data = err.response?.data as { message?: string };
//     if (typeof data?.message === "string") return data.message;
//     if (err.response?.status === 503) {
//       return "Online payments are not configured yet. Ask your lawyer or support.";
//     }
//     if (err.response?.status === 403) {
//       return "You are not allowed to pay this installment. Sign in as the client on this case.";
//     }
//   }
//   if (err instanceof Error) return err.message;
//   return "Failed to start payment. Please try again.";
// }

// function formatMoney(currency: string, value: number) {
//   return `${currency} ${value.toLocaleString(undefined, {
//     minimumFractionDigits: 0,
//     maximumFractionDigits: 2,
//   })}`;
// }

// function formatAgreementDate(iso: string) {
//   return new Date(iso).toLocaleDateString("en-US", {
//     weekday: "long",
//     year: "numeric",
//     month: "long",
//     day: "numeric",
//   });
// }

// function statusBadgeClass(status: Installment["status"]) {
//   switch (status) {
//     case "paid":
//       return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
//     case "pending":
//       return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
//     case "overdue":
//       return "bg-red-100 text-red-800 ring-1 ring-red-200";
//     default:
//       return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
//   }
// }

// function agreementStatusClass(status: string) {
//   switch (status) {
//     case "active":
//       return "bg-emerald-50 text-emerald-800 border-emerald-200";
//     case "completed":
//       return "bg-blue-50 text-blue-800 border-blue-200";
//     case "cancelled":
//       return "bg-red-50 text-red-800 border-red-200";
//     default:
//       return "bg-slate-50 text-slate-700 border-slate-200";
//   }
// }

// export function AgreementSnapshot({
//   caseName,
//   clientName,
//   lawyerName,
//   lawyerBaseFee,
//   agreedTotalAmount,
//   totalAmountPaid = 0,
//   createdAt,
//   currency,
//   installments,
//   agreementId,
//   agreementStatus = "active",
//   showPayNow = false,
// }: AgreementSnapshotProps) {
//   const [payingInstallmentId, setPayingInstallmentId] = useState<string | null>(
//     null
//   );
//   const [paymentError, setPaymentError] = useState<string | null>(null);

//   const remainingBalance = Math.max(0, agreedTotalAmount - totalAmountPaid);
//   const progressPercentage = agreedTotalAmount
//     ? Math.min(100, (totalAmountPaid / agreedTotalAmount) * 100)
//     : 0;

//   const nearestMarker = useMemo(() => {
//     return PROGRESS_MARKERS.reduce((prev, curr) =>
//       Math.abs(curr - progressPercentage) < Math.abs(prev - progressPercentage)
//         ? curr
//         : prev
//     );
//   }, [progressPercentage]);

//   const handlePayNow = async (installment: Installment) => {
//     try {
//       setPayingInstallmentId(installment.id);
//       setPaymentError(null);

//       const session = await createCheckoutSession({
//         installmentId: installment.id,
//         amount: installment.amount,
//         caseName,
//         currency: currency.toLowerCase(),
//       });

//       if (session?.sessionUrl) {
//         window.location.assign(session.sessionUrl);
//         return;
//       }
//       setPaymentError("Failed to create payment session");
//     } catch (error) {
//       setPaymentError(checkoutErrorMessage(error));
//     } finally {
//       setPayingInstallmentId(null);
//     }
//   };

//   return (
//     <article
//       className="mx-auto max-w-4xl overflow-hidden rounded-sm border border-[#d4c4a8] bg-[#fffdf8] shadow-[0_24px_60px_-32px_rgba(30,41,59,0.35)]"
//       aria-labelledby={`agreement-snapshot-${agreementId}`}
//     >
//       <header className="relative border-b-4 border-double border-[#1e3a2f] bg-gradient-to-b from-[#f7f3ea] to-[#fffdf8] px-8 pb-8 pt-10 text-center">
//         <div className="pointer-events-none absolute inset-x-8 top-4 h-px bg-[#c9b896]" />
//         <div className="pointer-events-none absolute inset-x-8 top-5 h-px bg-[#c9b896]/60" />
//         <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#1e3a2f] bg-white shadow-sm">
//           <Scale className="h-7 w-7 text-[#1e3a2f]" strokeWidth={1.5} />
//         </div>
//         <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#5c6b63]">
//           LawFlow Digital Contract
//         </p>
//         <h1
//           id={`agreement-snapshot-${agreementId}`}
//           className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#14281f]"
//         >
//           Agreement Snapshot
//         </h1>
//         <p className="mt-2 text-sm text-[#5c6b63]">
//           Binding payment schedule &amp; contract summary
//         </p>
//       </header>

//       <div className="px-8 py-8">
//         <section className="rounded-lg border border-[#e8dfd0] bg-white/80 p-5">
//           <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#efe6d7] pb-4">
//             <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#5c6b63]">
//               <FileText className="h-4 w-4 text-[#1e3a2f]" />
//               Contract Parties
//             </div>
//             <span
//               className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${agreementStatusClass(agreementStatus)}`}
//             >
//               {agreementStatus}
//             </span>
//           </div>

//           <div className="grid gap-4 sm:grid-cols-2">
//             <div className="space-y-3">
//               <div>
//                 <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8174]">
//                   Case Title
//                 </p>
//                 <p className="mt-1 font-serif text-lg font-semibold text-[#14281f]">
//                   {caseName}
//                 </p>
//               </div>
//               <div>
//                 <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8174]">
//                   Agreement Date
//                 </p>
//                 <p className="mt-1 flex items-center gap-2 text-sm font-medium text-[#334155]">
//                   <Calendar className="h-4 w-4 text-[#1e3a2f]" />
//                   {formatAgreementDate(createdAt)}
//                 </p>
//               </div>
//             </div>
//             <div className="space-y-3">
//               <div className="flex items-start gap-3 rounded-lg border border-[#efe6d7] bg-[#faf8f4] p-3">
//                 <User className="mt-0.5 h-4 w-4 shrink-0 text-[#1e3a2f]" />
//                 <div>
//                   <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8174]">
//                     Client
//                   </p>
//                   <p className="text-sm font-semibold text-[#14281f]">{clientName}</p>
//                 </div>
//               </div>
//               <div className="flex items-start gap-3 rounded-lg border border-[#efe6d7] bg-[#faf8f4] p-3">
//                 <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-[#1e3a2f]" />
//                 <div>
//                   <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8174]">
//                     Lawyer
//                   </p>
//                   <p className="text-sm font-semibold text-[#14281f]">{lawyerName}</p>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </section>

//         <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
//           {[
//             {
//               label: "Base Fee",
//               value: formatMoney(currency, lawyerBaseFee),
//               accent: "border-l-[#1e3a2f]",
//             },
//             {
//               label: "Total Contract Value",
//               value: formatMoney(currency, agreedTotalAmount),
//               accent: "border-l-[#334155]",
//             },
//             {
//               label: "Paid Amount",
//               value: formatMoney(currency, totalAmountPaid),
//               accent: "border-l-emerald-600",
//             },
//             {
//               label: "Remaining Balance",
//               value: formatMoney(currency, remainingBalance),
//               accent: "border-l-amber-600",
//             },
//           ].map((card) => (
//             <div
//               key={card.label}
//               className={`rounded-lg border border-[#e8dfd0] border-l-4 bg-white p-4 shadow-sm ${card.accent}`}
//             >
//               <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8174]">
//                 {card.label}
//               </p>
//               <p className="mt-2 font-serif text-xl font-bold text-[#14281f]">
//                 {card.value}
//               </p>
//             </div>
//           ))}
//         </section>

//         <section className="mt-8 rounded-lg border border-[#e8dfd0] bg-white p-5">
//           <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
//             <div>
//               <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8174]">
//                 Payment Progress
//               </p>
//               <p className="mt-1 font-serif text-2xl font-bold text-[#14281f]">
//                 {progressPercentage.toFixed(0)}%
//               </p>
//             </div>
//             <p className="text-xs text-[#64748b]">
//               Nearest milestone: {nearestMarker}%
//             </p>
//           </div>

//           <div className="relative pt-2">
//             <div className="h-3 overflow-hidden rounded-full bg-[#efe6d7]">
//               <div
//                 className="h-full rounded-full bg-gradient-to-r from-[#1e3a2f] via-[#2d5a45] to-emerald-600 transition-all duration-700 ease-out"
//                 style={{ width: `${progressPercentage}%` }}
//               />
//             </div>
//             <div className="mt-3 flex justify-between">
//               {PROGRESS_MARKERS.map((marker) => (
//                 <div key={marker} className="flex flex-col items-center">
//                   <span
//                     className={`mb-1 h-2 w-2 rounded-full ${
//                       progressPercentage >= marker
//                         ? "bg-[#1e3a2f]"
//                         : "bg-[#d4c4a8]"
//                     }`}
//                   />
//                   <span
//                     className={`text-[10px] font-semibold ${
//                       progressPercentage >= marker
//                         ? "text-[#1e3a2f]"
//                         : "text-[#a8a29e]"
//                     }`}
//                   >
//                     {marker}%
//                   </span>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </section>

//         <section className="mt-8">
//           <div className="mb-4 flex items-center gap-2">
//             <ShieldCheck className="h-5 w-5 text-[#1e3a2f]" />
//             <h2 className="font-serif text-xl font-bold text-[#14281f]">
//               Installment Schedule
//             </h2>
//           </div>

//           {paymentError && (
//             <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
//               {paymentError}
//             </div>
//           )}

//           {installments.length === 0 ? (
//             <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
//               No installments are on this agreement yet. Ask your lawyer to add a payment
//               schedule, or create a new agreement with installment rows.
//             </p>
//           ) : (
//           <div className="overflow-x-auto rounded-lg border border-[#e8dfd0]">
//             <table className="w-full min-w-[640px]">
//               <thead>
//                 <tr className="border-b border-[#e8dfd0] bg-[#f7f3ea]">
//                   {["Installment", "Due Date", "Amount", "Status", "Action"].map(
//                     (heading) => (
//                       <th
//                         key={heading}
//                         className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5c6b63]"
//                       >
//                         {heading}
//                       </th>
//                     )
//                   )}
//                 </tr>
//               </thead>
//               <tbody>
//                 {installments.map((installment) => (
//                   <tr
//                     key={installment.id}
//                     className="border-b border-[#f1ebe1] last:border-0 odd:bg-white even:bg-[#fffdf8]"
//                   >
//                     <td className="px-4 py-3 text-sm font-semibold text-[#14281f]">
//                       {installment.installmentNumber === 0
//                         ? "Lawyer base fee"
//                         : `#${installment.installmentNumber}`}
//                     </td>
//                     <td className="px-4 py-3 text-sm text-[#475569]">
//                       {installment.dueDate
//                         ? new Date(installment.dueDate).toLocaleDateString(
//                             "en-US",
//                             {
//                               month: "short",
//                               day: "numeric",
//                               year: "numeric",
//                             }
//                           )
//                         : "—"}
//                     </td>
//                     <td className="px-4 py-3 text-sm font-semibold text-[#14281f]">
//                       {formatMoney(currency, installment.amount)}
//                     </td>
//                     <td className="px-4 py-3">
//                       <span
//                         className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusBadgeClass(installment.status)}`}
//                       >
//                         {installment.status}
//                       </span>
//                     </td>
//                     <td className="px-4 py-3">
//                       {showPayNow && installment.status === "pending" ? (
//                         <button
//                           type="button"
//                           onClick={() => handlePayNow(installment)}
//                           disabled={payingInstallmentId === installment.id}
//                           className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e3a2f] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#14281f] disabled:cursor-not-allowed disabled:bg-slate-400"
//                         >
//                           <CreditCard className="h-3.5 w-3.5" />
//                           {payingInstallmentId === installment.id
//                             ? "Processing…"
//                             : "Pay Now"}
//                         </button>
//                       ) : installment.status === "paid" && installment.paidAt ? (
//                         <span className="text-xs text-emerald-700">
//                           Paid{" "}
//                           {new Date(installment.paidAt).toLocaleDateString()}
//                         </span>
//                       ) : (
//                         <span className="text-xs text-slate-400">—</span>
//                       )}
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//           )}
//         </section>

//         <footer className="mt-8 rounded-lg border border-[#d4e8dc] bg-[#f4faf6] px-4 py-3 text-xs leading-relaxed text-[#2d5a45]">
//           This digital agreement snapshot reflects the negotiated contract recorded in
//           LawFlow. Official receipts are issued upon successful payment of each
//           installment.
//         </footer>
//       </div>
//     </article>
//   );
// }
