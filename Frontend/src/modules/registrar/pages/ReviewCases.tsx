import { CheckCircle, FileText, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import RegistrarLayout from "../components/RegistrarLayout";
import Card from "../../../shared/components/dashboard/Card";
import { useCaseFilingStore } from "../../lawyer/store/caseFiling.store";
import { getFcfsSubmissionQueue } from "../utils/submissionQueue";
import { useRegistrarReviewDecisionStore } from "../store/reviewDecisions.store";

export default function ReviewCases() {
  const navigate = useNavigate();
  const { caseId } = useParams({ from: "/review-cases/$caseId" });
  const [action, setAction] = useState<"approve" | "return" | null>(null);
  const [remarks, setRemarks] = useState("");

  const liveSubmittedCases = useCaseFilingStore((state) =>
    state.getSubmittedCasesForRegistrar()
  );
  const decisionsByCaseId = useRegistrarReviewDecisionStore(
    (state) => state.decisionsByCaseId
  );
  const markCaseReturned = useRegistrarReviewDecisionStore(
    (state) => state.markCaseReturned
  );
  const markCaseApproved = useRegistrarReviewDecisionStore(
    (state) => state.markCaseApproved
  );
  const excludedCaseIds = useMemo(
    () =>
      new Set(
        Object.entries(decisionsByCaseId)
          .filter(([, decision]) => decision.status === "approved" || decision.status === "returned")
          .map(([id]) => id)
      ),
    [decisionsByCaseId]
  );
  const pendingQueue = getFcfsSubmissionQueue(liveSubmittedCases, excludedCaseIds);
  const allSubmittedCases = getFcfsSubmissionQueue(liveSubmittedCases);
  const caseData = allSubmittedCases.find((item) => item.caseId === caseId);

  if (!caseData) {
    return (
      <RegistrarLayout pageSubtitle="Review Case">
        <div className="p-10 text-center text-gray-600">Case not found in registrar queue.</div>
      </RegistrarLayout>
    );
  }

  const handleConfirmApproval = () => {
    markCaseApproved({ caseData });
    navigate({ to: "/schedule-hearing/$caseId", params: { caseId: caseData.caseId } });
  };

  return (
    <RegistrarLayout pageSubtitle="Review Case" notificationBadge={pendingQueue.length}>
      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Case Information
          </h2>
          <div className="grid grid-cols-1 gap-y-6 md:grid-cols-2">
            <div>
              <p className="text-xs text-gray-400">Case Title</p>
              <p className="font-medium text-gray-800">{caseData.title}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Lawyer</p>
              <p className="font-medium text-gray-800">{caseData.submittedBy}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Client</p>
              <p className="font-medium text-gray-800">{caseData.clientName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Category</p>
              <p className="font-medium capitalize text-gray-800">{caseData.caseType}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Tehsil</p>
              <p className="font-medium text-gray-800">{caseData.tehsil}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Submitted At</p>
              <p className="font-medium text-gray-800">
                {new Date(caseData.submittedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Case Bundle Documents
          </h2>
          <div className="space-y-2">
            {caseData.bundle.orderedDocuments.map((doc, index) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 p-3 transition-colors hover:bg-gray-100"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-[#01411C]" />
                  <div>
                    <span className="text-sm text-gray-700">
                      {index + 1}. {doc.title}
                    </span>
                    <p className="text-xs capitalize text-gray-500">
                      {doc.category.replace("_", " ")}
                    </p>
                  </div>
                </div>
                {doc.signedRequired ? (
                  doc.signedCompleted ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      Signed
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      Signature Pending
                    </span>
                  )
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    No Signature Required
                  </span>
                )}
              </div>
            ))}
          </div>

          <h2 className="mb-4 mt-6 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Evidence Files
          </h2>
          <div className="space-y-2">
            {caseData.bundle.evidenceFiles.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                No evidence files attached.
              </div>
            ) : (
              caseData.bundle.evidenceFiles.map((file) => (
                <div
                  key={file.id}
                  className="rounded-md border border-gray-100 bg-gray-50 p-3"
                >
                  <p className="text-sm font-medium text-gray-800">{file.title}</p>
                  <p className="text-xs text-gray-500">
                    {file.sizeLabel} - {new Date(file.uploadedAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Review Decision
          </h2>

          {!action ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <button
                onClick={() => setAction("approve")}
                className="flex items-center justify-center gap-2 rounded-md bg-[#01411C] py-3 font-medium text-white transition hover:bg-[#025a27]"
              >
                <CheckCircle className="h-4 w-4" /> Approve Case
              </button>
              <button
                onClick={() => setAction("return")}
                className="flex items-center justify-center gap-2 rounded-md bg-red-600 py-3 font-medium text-white transition hover:bg-red-700"
              >
                <XCircle className="h-4 w-4" /> Return for Corrections
              </button>
            </div>
          ) : action === "approve" ? (
            <div className="space-y-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-gray-800">Approve this case?</h3>
                <p className="text-sm text-gray-500">
                  This case will be approved and you will be redirected to schedule the hearing.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => setAction(null)}
                  className="rounded-md border px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmApproval}
                  className="rounded-md bg-[#01411C] px-6 py-2 text-sm font-medium text-white hover:bg-[#025a27]"
                >
                  Confirm & Schedule Hearing
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">
                  Remarks for Lawyer
                </label>
                <textarea
                  className="w-full rounded-md border p-3 text-sm outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Specify what needs to be corrected..."
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setAction(null)}
                  className="rounded-md border px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    markCaseReturned({ caseData, remarks });
                    navigate({ to: "/return-case" });
                  }}
                  disabled={!remarks}
                  className="rounded-md bg-red-600 px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Submit & Return Case
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </RegistrarLayout>
  );
}
