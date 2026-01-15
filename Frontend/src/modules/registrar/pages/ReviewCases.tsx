import { ArrowLeft, CheckCircle, XCircle, FileText, Eye } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { mockCases } from "../data/viewcase.mock"; 
import type { Case } from "../types/case";

export default function ReviewCases() {
  const navigate = useNavigate();
  const { caseId } = useParams({ from: '/review-cases/$caseId' });
  const [action, setAction] = useState<"approve" | "return" | null>(null);
  const [remarks, setRemarks] = useState("");

  const caseData: Case | undefined = mockCases.find(c => c.id.toString() === caseId);

  if (!caseData) return <div className="p-10 text-center">Case Not Found</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-[#01411C] text-white py-3 px-6 shadow-md">
        <div className="container mx-auto flex items-center gap-3">
          <button onClick={() => navigate({ to: "/view-cases" })} className="hover:bg-white/10 p-1 rounded">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Review Case</h1>
            <p className="text-xs opacity-80">{caseData.caseNumber}</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        <section className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Case Information</h2>
          <div className="grid grid-cols-2 gap-y-6">
            <div>
              <p className="text-xs text-gray-400">Case Title</p>
              <p className="font-medium text-gray-800">{caseData.title || "Property Dispute Resolution"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Lawyer</p>
              <p className="font-medium text-gray-800">Adv. Fatima Ali</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Client</p>
              <p className="font-medium text-gray-800">Ahmed Khan</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Category</p>
              <p className="font-medium text-gray-800">Civil Law</p>
            </div>
          </div>
        </section>
        <section className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Documents</h2>
          <div className="space-y-2">
            {["Case Petition", "Client CNIC", "Property Documents", "Lawyer Signature", "Client Signature"].map((doc) => (
              <div key={doc} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-100 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-green-700" />
                  <span className="text-sm text-gray-700">{doc}</span>
                </div>
                <Eye className="h-4 w-4 text-gray-400 cursor-pointer" />
              </div>
            ))}
          </div>
        </section>
        <section className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-6 uppercase tracking-wider">Review Decision</h2>
          
          {!action ? (
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setAction("approve")} className="py-3 bg-green-600 text-white rounded-md font-medium flex items-center justify-center gap-2 hover:bg-green-700 transition-all">
                <CheckCircle className="h-4 w-4" /> Approve Case
              </button>
              <button onClick={() => setAction("return")} className="py-3 bg-red-600 text-white rounded-md font-medium flex items-center justify-center gap-2 hover:bg-red-700 transition-all">
                <XCircle className="h-4 w-4" /> Return for Corrections
              </button>
            </div>
          ) : action === "approve" ? (
            <div className="text-center space-y-4">
               <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <CheckCircle className="h-8 w-8" />
                  </div>
                  <h3 className="font-bold text-gray-800">Approve This Case?</h3>
                  <p className="text-sm text-gray-500">This case will be approved and moved to hearing scheduling.</p>
               </div>
               <div className="flex gap-3 justify-center pt-2">
                 <button onClick={() => setAction(null)} className="px-6 py-2 border rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                 <button onClick={() => navigate({ to: "/approved-cases" })} className="px-6 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700">Confirm Approval</button>
               </div>
            </div>
          ) : (
            <div className="space-y-4">
               <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Remarks for Lawyer</label>
                  <textarea 
                    className="w-full border rounded-md p-3 text-sm focus:ring-1 focus:ring-red-500 outline-none" 
                    placeholder="Specify what needs to be corrected..." 
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
               </div>
               <div className="flex gap-3 justify-start">
                 <button onClick={() => setAction(null)} className="px-6 py-2 border rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                 <button 
                  onClick={() => navigate({ to: "/return-case" })} 
                  disabled={!remarks}
                  className="px-6 py-2 bg-red-600 text-white rounded-md text-sm font-medium disabled:opacity-50"
                 >
                   Submit & Return Case
                 </button>
               </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}