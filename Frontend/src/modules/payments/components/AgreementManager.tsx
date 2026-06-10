// import React, { useEffect, useState } from "react";
// import { AgreementForm } from "./AgreementForm";
// import { AgreementSnapshot } from "./AgreementSnapshot";
// import { getAgreement } from "../api";

// interface AgreementManagerProps {
//   existingAgreementId?: string;
// }

// export function AgreementManager({ existingAgreementId }: AgreementManagerProps) {
//   const [snapshot, setSnapshot] = useState<Awaited<
//     ReturnType<typeof getAgreement>
//   > | null>(null);
//   const [loading, setLoading] = useState(!!existingAgreementId);

//   useEffect(() => {
//     if (!existingAgreementId) return;
//     (async () => {
//       try {
//         setLoading(true);
//         const data = await getAgreement(existingAgreementId);
//         setSnapshot(data);
//       } catch {
//         setSnapshot(null);
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, [existingAgreementId]);

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center p-8">
//         <p className="text-gray-600">Loading agreement…</p>
//       </div>
//     );
//   }

//   if (snapshot) {
//     return (
//       <AgreementSnapshot
//         caseName={
//           snapshot.caseTitle?.trim() ||
//           snapshot.caseTypeName ||
//           snapshot.clientName
//         }
//         clientName={snapshot.clientName}
//         lawyerName={snapshot.lawyerName}
//         lawyerBaseFee={snapshot.agreement.lawyerBaseFee}
//         agreedTotalAmount={snapshot.agreement.agreedTotalAmount}
//         totalAmountPaid={snapshot.totalAmountPaid}
//         createdAt={snapshot.agreement.createdAt}
//         currency={snapshot.agreement.currency}
//         installments={snapshot.installments}
//         agreementId={snapshot.agreement.id}
//         agreementStatus={snapshot.agreement.status}
//         showPayNow={false}
//       />
//     );
//   }

//   return <AgreementForm />;
// }
