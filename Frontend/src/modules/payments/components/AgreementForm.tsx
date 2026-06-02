// import React, { useEffect, useMemo, useState } from "react";
// import { Link } from "@tanstack/react-router";
// import { AlertCircle, CheckCircle, Info, Plus, Trash2, User } from "lucide-react";
// import axios from "axios";
// import {
//   createAgreement,
//   getLawyerAgreementCases,
//   getLawyerCaseAgreementContext,
//   getServiceCharges,
//   type AgreementSnapshotData,
// } from "../api";
// import { AgreementSnapshot } from "./AgreementSnapshot";

// type InstallmentDraft = {
//   key: string;
//   amount: string;
//   dueDate: string;
// };

// function todayIsoDate() {
//   return new Date().toISOString().slice(0, 10);
// }

// function newInstallmentDraft(): InstallmentDraft {
//   return {
//     key: `inst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
//     amount: "",
//     dueDate: "",
//   };
// }

// function roundMoney(value: number) {
//   return Math.round(value * 100) / 100;
// }

// function extractErrorMessage(err: unknown): string {
//   if (axios.isAxiosError(err)) {
//     const data = err.response?.data as {
//       message?: string;
//       errors?: Array<{ msg?: string }>;
//     };
//     if (typeof data?.message === "string") return data.message;
//     if (Array.isArray(data?.errors) && data.errors.length > 0) {
//       return data.errors.map((e) => e.msg).filter(Boolean).join(". ");
//     }
//   }
//   if (err instanceof Error) return err.message;
//   return "Something went wrong. Please try again.";
// }

// export function AgreementForm() {
//   const [baseFeeLoading, setBaseFeeLoading] = useState(true);
//   const [lawyerBaseFee, setLawyerBaseFee] = useState(0);
//   const [hasBaseFee, setHasBaseFee] = useState(false);

//   const [cases, setCases] = useState<
//     Awaited<ReturnType<typeof getLawyerAgreementCases>>
//   >([]);
//   const [casesLoading, setCasesLoading] = useState(true);
//   const [selectedCaseId, setSelectedCaseId] = useState("");
//   const [caseContext, setCaseContext] = useState<Awaited<
//     ReturnType<typeof getLawyerCaseAgreementContext>
//   > | null>(null);
//   const [contextLoading, setContextLoading] = useState(false);

//   const [agreedTotal, setAgreedTotal] = useState("");
//   const [installments, setInstallments] = useState<InstallmentDraft[]>([
//     newInstallmentDraft(),
//   ]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [formErrors, setFormErrors] = useState<Record<string, string>>({});
//   const [savedSnapshot, setSavedSnapshot] = useState<AgreementSnapshotData | null>(
//     null
//   );
//   const [isSaved, setIsSaved] = useState(false);

//   useEffect(() => {
//     (async () => {
//       try {
//         setBaseFeeLoading(true);
//         const charges = await getServiceCharges();
//         const fee = charges?.baseFee ?? 0;
//         setLawyerBaseFee(fee);
//         setHasBaseFee(fee > 0);
//       } catch {
//         setHasBaseFee(false);
//       } finally {
//         setBaseFeeLoading(false);
//       }
//     })();
//   }, []);

//   useEffect(() => {
//     (async () => {
//       try {
//         setCasesLoading(true);
//         const list = await getLawyerAgreementCases();
//         setCases(list);
//       } catch {
//         setError("Failed to load cases. Please refresh.");
//       } finally {
//         setCasesLoading(false);
//       }
//     })();
//   }, []);

//   useEffect(() => {
//     if (!selectedCaseId) {
//       setCaseContext(null);
//       return;
//     }

//     (async () => {
//       try {
//         setContextLoading(true);
//         setError(null);
//         const ctx = await getLawyerCaseAgreementContext(selectedCaseId);
//         setCaseContext(ctx);
//         if (ctx.baseFee != null && ctx.baseFee > 0) {
//           setLawyerBaseFee(ctx.baseFee);
//           setHasBaseFee(true);
//         }
//       } catch (err) {
//         setCaseContext(null);
//         setError(extractErrorMessage(err));
//       } finally {
//         setContextLoading(false);
//       }
//     })();
//   }, [selectedCaseId]);

//   const agreedAmount = useMemo(
//     () => parseFloat(agreedTotal) || 0,
//     [agreedTotal]
//   );

//   /** Installments must sum to the full agreed contract amount. */
//   const installmentTarget = agreedAmount;

//   const installmentSum = useMemo(() => {
//     return installments.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
//   }, [installments]);

//   const eligibleCases = cases.filter((c) => !c.hasAgreement);

//   const selectedCase = useMemo(
//     () => cases.find((c) => c.id === selectedCaseId),
//     [cases, selectedCaseId]
//   );

//   const resolvedClientUserId =
//     caseContext?.case.clientUserId ?? selectedCase?.clientUserId ?? null;

//   const needsInstallments = agreedAmount > 0;

//   const validateForm = () => {
//     const errors: Record<string, string> = {};
//     const agreed = parseFloat(agreedTotal);

//     if (!selectedCaseId) {
//       errors.case = "Select a case";
//     }
//     if (!agreedTotal || agreed <= 0) {
//       errors.agreedTotal = "Agreed total must be greater than 0";
//     }
//     if (!resolvedClientUserId) {
//       errors.client =
//         "No LawFlow client account matches this case email. Edit the case and use the client's registered login email.";
//     }

//     if (needsInstallments) {
//       const today = new Date();
//       today.setHours(0, 0, 0, 0);
//       const dueDates = new Set<string>();
//       let total = 0;

//       installments.forEach((row, index) => {
//         const amount = parseFloat(row.amount);
//         if (!amount || amount <= 0) {
//           errors[`installment-${index}`] = "Amount must be greater than zero";
//         } else {
//           total += amount;
//         }
//         if (!row.dueDate) {
//           errors[`due-${index}`] = "Due date is required";
//         } else {
//           const due = new Date(row.dueDate + "T12:00:00");
//           due.setHours(0, 0, 0, 0);
//           if (due < today) {
//             errors[`due-${index}`] = "Due date cannot be in the past";
//           }
//           if (dueDates.has(row.dueDate)) {
//             errors[`due-${index}`] = "Duplicate due date";
//           }
//           dueDates.add(row.dueDate);
//         }
//       });

//       if (roundMoney(total) !== roundMoney(installmentTarget)) {
//         errors.installments = `Installments must total PKR ${installmentTarget.toLocaleString()} (currently PKR ${total.toLocaleString()})`;
//       }
//     }

//     setFormErrors(errors);
//     return Object.keys(errors).length === 0;
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setError(null);

//     if (!validateForm()) {
//       setError("Please fix the highlighted errors before saving.");
//       return;
//     }

//     if (!resolvedClientUserId) {
//       return;
//     }

//     try {
//       setLoading(true);

//       const snapshot = await createAgreement({
//         caseId: selectedCaseId,
//         clientUserId: resolvedClientUserId,
//         agreedTotalAmount: parseFloat(agreedTotal),
//         installments: installments.map((row) => ({
//           amount: parseFloat(row.amount),
//           dueDate: row.dueDate,
//         })),
//       });

//       setSavedSnapshot(snapshot);
//       setIsSaved(true);
//     } catch (err) {
//       setError(extractErrorMessage(err));
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (baseFeeLoading || casesLoading) {
//     return (
//       <div className="flex items-center justify-center p-8">
//         <p className="text-gray-600">Loading…</p>
//       </div>
//     );
//   }

//   if (isSaved && savedSnapshot) {
//     return (
//       <div className="space-y-6">
//         <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
//           <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
//           <p className="text-sm text-green-800">
//             Agreement saved. The digital contract snapshot is below.
//           </p>
//         </div>
//         <AgreementSnapshot
//           caseName={savedSnapshot.caseTitle}
//           clientName={savedSnapshot.clientName}
//           lawyerName={savedSnapshot.lawyerName}
//           lawyerBaseFee={savedSnapshot.agreement.lawyerBaseFee}
//           agreedTotalAmount={savedSnapshot.agreement.agreedTotalAmount}
//           totalAmountPaid={savedSnapshot.totalAmountPaid}
//           createdAt={savedSnapshot.agreement.createdAt}
//           currency={savedSnapshot.agreement.currency}
//           installments={savedSnapshot.installments}
//           agreementId={savedSnapshot.agreement.id}
//           agreementStatus={savedSnapshot.agreement.status}
//           showPayNow={false}
//         />
//       </div>
//     );
//   }

//   if (!hasBaseFee) {
//     return (
//       <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
//         <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-600" />
//         <p className="font-medium text-amber-900">
//           You must set your service charges before creating an agreement.
//         </p>
//         <p className="mt-2 text-sm text-amber-800">
//           Save your lawyer base fee first, then return here to build the installment plan.
//         </p>
//         <Link
//           to="/lawyer-service-charges"
//           className="mt-4 inline-block rounded-lg bg-[#01411C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#024a23]"
//         >
//           Set Service Charges
//         </Link>
//       </div>
//     );
//   }

//   if (eligibleCases.length === 0) {
//     return (
//       <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
//         <p className="text-base font-medium text-gray-800">
//           No cases available for agreement creation.
//         </p>
//         <p className="mt-2 text-sm text-gray-600">
//           Create a case first, or all your cases already have agreements.
//         </p>
//       </div>
//     );
//   }

//   return (
//     <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
//       <h2 className="text-2xl font-bold text-gray-900">Create Agreement</h2>
//       <p className="mt-1 text-sm text-gray-600">
//         Select a case, confirm client details, and build the installment plan.
//       </p>

//       {error && (
//         <div className="mt-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
//           <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
//           <p className="text-sm text-red-800">{error}</p>
//         </div>
//       )}

//       <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
//         <div className="flex items-start gap-3">
//           <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
//           <div>
//             <p className="text-sm font-medium text-blue-900">Your Lawyer Base Fee</p>
//             <p className="mt-1 text-2xl font-bold text-blue-800">
//               PKR {lawyerBaseFee.toLocaleString()}
//             </p>
//           </div>
//         </div>
//       </div>

//       <form onSubmit={handleSubmit} className="mt-6 space-y-6">
//         <div>
//           <label className="mb-2 block text-sm font-medium text-gray-700">
//             Select Case <span className="text-red-600">*</span>
//           </label>
//           <select
//             value={selectedCaseId}
//             onChange={(e) => setSelectedCaseId(e.target.value)}
//             className={`w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 ${
//               formErrors.case
//                 ? "border-red-500 focus:ring-red-500"
//                 : "border-gray-300 focus:ring-blue-500"
//             }`}
//           >
//             <option value="">Choose a case…</option>
//             {eligibleCases.map((item) => (
//               <option key={item.id} value={item.id}>
//                 {item.title} — {item.clientName}
//               </option>
//             ))}
//           </select>
//           {formErrors.case && (
//             <p className="mt-1 text-sm text-red-600">{formErrors.case}</p>
//           )}
//         </div>

//         {selectedCaseId && (
//           <>
//             {contextLoading ? (
//               <p className="text-sm text-gray-600">Loading case details…</p>
//             ) : caseContext ? (
//               <div className="space-y-4">
//                 <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-5">
//                   <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-sky-900">
//                     <User className="h-4 w-4" />
//                     Client Information
//                   </div>
//                   <div className="grid gap-4 sm:grid-cols-3">
//                     <div>
//                       <p className="text-xs font-semibold uppercase text-sky-800/70">
//                         Client Name
//                       </p>
//                       <p className="mt-1 font-medium text-gray-900">
//                         {caseContext.case.clientName}
//                       </p>
//                     </div>
//                     <div>
//                       <p className="text-xs font-semibold uppercase text-sky-800/70">Email</p>
//                       <p className="mt-1 text-sm text-gray-800 break-all">
//                         {caseContext.case.clientEmail || "—"}
//                       </p>
//                     </div>
//                     <div>
//                       <p className="text-xs font-semibold uppercase text-sky-800/70">Phone</p>
//                       <p className="mt-1 text-sm text-gray-800">
//                         {caseContext.case.clientPhone || "—"}
//                       </p>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
//                   <p className="mb-3 text-sm font-semibold text-gray-800">Case Details</p>
//                   <div className="grid gap-4 sm:grid-cols-2">
//                     <div>
//                       <p className="text-xs font-semibold uppercase text-gray-500">
//                         Case Title
//                       </p>
//                       <p className="mt-1 font-medium text-gray-900">
//                         {caseContext.case.title}
//                       </p>
//                     </div>
//                     <div>
//                       <p className="text-xs font-semibold uppercase text-gray-500">
//                         Case Category
//                       </p>
//                       <p className="mt-1 text-sm capitalize text-gray-800">
//                         {caseContext.case.caseCategory}
//                       </p>
//                     </div>
//                     <div className="sm:col-span-2">
//                       <p className="text-xs font-semibold uppercase text-gray-500">
//                         Case Type
//                       </p>
//                       <p className="mt-1 text-sm text-gray-800">
//                         {caseContext.case.caseTypeName}
//                       </p>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             ) : null}
//             {!contextLoading && !resolvedClientUserId && (
//               <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
//                 <p className="font-medium">Client account not linked</p>
//                 <p className="mt-1">
//                   Case email{" "}
//                   <strong>{caseContext?.case.clientEmail || selectedCase?.clientEmail || "—"}</strong>{" "}
//                   must match a registered client on LawFlow. Update the case with the
//                   client&apos;s login email, then select the case again.
//                 </p>
//               </div>
//             )}
//             {formErrors.client && (
//               <p className="text-sm text-red-600">{formErrors.client}</p>
//             )}
//           </>
//         )}

//         <div>
//           <label className="mb-2 block text-sm font-medium text-gray-700">
//             Agreed Total Amount <span className="text-red-600">*</span>
//           </label>
//           <div className="relative">
//             <span className="absolute left-3 top-3 text-gray-500">PKR</span>
//             <input
//               type="number"
//               min="0.01"
//               step="0.01"
//               placeholder="Enter total contract amount"
//               value={agreedTotal}
//               onChange={(e) => setAgreedTotal(e.target.value)}
//               className={`w-full rounded-lg border py-2.5 pl-12 pr-4 focus:outline-none focus:ring-2 ${
//                 formErrors.agreedTotal
//                   ? "border-red-500 focus:ring-red-500"
//                   : "border-gray-300 focus:ring-blue-500"
//               }`}
//             />
//           </div>
//           {formErrors.agreedTotal && (
//             <p className="mt-1 text-sm text-red-600">{formErrors.agreedTotal}</p>
//           )}
//         </div>

//         <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-slate-50 p-4 text-sm sm:grid-cols-3">
//           <div>
//             <p className="text-gray-500">Base Fee</p>
//             <p className="font-semibold text-gray-900">
//               PKR {lawyerBaseFee.toLocaleString()}
//             </p>
//           </div>
//           <div>
//             <p className="text-gray-500">Agreed Total</p>
//             <p className="font-semibold text-gray-900">
//               PKR {(parseFloat(agreedTotal) || 0).toLocaleString()}
//             </p>
//           </div>
//           <div>
//             <p className="text-gray-500">Installment target</p>
//             <p className="font-semibold text-gray-900">
//               PKR {installmentTarget.toLocaleString()}
//             </p>
//           </div>
//         </div>

//         {selectedCaseId && agreedAmount > 0 && (
//         <div className="rounded-xl border border-gray-200 bg-white p-4">
//           <div className="mb-3 flex items-center justify-between">
//             <h3 className="font-semibold text-gray-900">Installment Plan</h3>
//             <button
//               type="button"
//               onClick={() =>
//                 setInstallments((prev) => [...prev, newInstallmentDraft()])
//               }
//               className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
//             >
//               <Plus className="h-3.5 w-3.5" />
//               Add Installment
//             </button>
//           </div>

//           {formErrors.installments && (
//             <p className="mb-2 text-sm text-red-600">{formErrors.installments}</p>
//           )}

//           <div className="space-y-3">
//             {installments.map((row, index) => (
//               <div
//                 key={row.key}
//                 className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 md:grid-cols-[1fr_1fr_auto]"
//               >
//                 <div>
//                   <label className="mb-1 block text-xs font-medium text-gray-600">
//                     Installment {index + 1} — Amount (PKR)
//                   </label>
//                   <input
//                     type="number"
//                     min="0.01"
//                     step="0.01"
//                     value={row.amount}
//                     onChange={(e) =>
//                       setInstallments((prev) =>
//                         prev.map((item) =>
//                           item.key === row.key
//                             ? { ...item, amount: e.target.value }
//                             : item
//                         )
//                       )
//                     }
//                     className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
//                   />
//                   {formErrors[`installment-${index}`] && (
//                     <p className="mt-1 text-xs text-red-600">
//                       {formErrors[`installment-${index}`]}
//                     </p>
//                   )}
//                 </div>
//                 <div>
//                   <label className="mb-1 block text-xs font-medium text-gray-600">
//                     Due Date
//                   </label>
//                   <input
//                     type="date"
//                     min={todayIsoDate()}
//                     value={row.dueDate}
//                     onChange={(e) =>
//                       setInstallments((prev) =>
//                         prev.map((item) =>
//                           item.key === row.key
//                             ? { ...item, dueDate: e.target.value }
//                             : item
//                         )
//                       )
//                     }
//                     className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
//                   />
//                   {formErrors[`due-${index}`] && (
//                     <p className="mt-1 text-xs text-red-600">
//                       {formErrors[`due-${index}`]}
//                     </p>
//                   )}
//                 </div>
//                 <div className="flex items-end">
//                   <button
//                     type="button"
//                     disabled={installments.length <= 1}
//                     onClick={() =>
//                       setInstallments((prev) =>
//                         prev.filter((item) => item.key !== row.key)
//                       )
//                     }
//                     className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"
//                     aria-label="Remove installment"
//                   >
//                     <Trash2 className="h-4 w-4" />
//                   </button>
//                 </div>
//               </div>
//             ))}
//           </div>

//           <p className="mt-2 text-xs text-gray-600">
//             Installment total: PKR {installmentSum.toLocaleString()} / PKR{" "}
//             {installmentTarget.toLocaleString()} required (must match agreed total). The
//             lawyer base fee (PKR {lawyerBaseFee.toLocaleString()}) is added automatically as a
//             separate Pay Now row for the client.
//           </p>
//         </div>
//         )}

//         <button
//           type="submit"
//           disabled={loading || !selectedCaseId}
//           className="w-full rounded-lg bg-[#01411C] py-3 font-medium text-white hover:bg-[#024a23] disabled:cursor-not-allowed disabled:bg-gray-400"
//         >
//           {loading ? "Saving Agreement…" : "Save Agreement"}
//         </button>
//       </form>
//     </div>
//   );
// }
