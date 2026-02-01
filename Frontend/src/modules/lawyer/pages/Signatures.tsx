import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, FileText, Send } from "lucide-react";
import LawyerLayout from "../components/LawyerLayout";
import { useSignatureRequestsStore } from "../signatures/store/signatureRequests.store";
import { lawyerDashboardCases } from "../data/dashboard.mock";

export default function Signatures() {
  const navigate = useNavigate();
  const { requests, updateRequest } = useSignatureRequestsStore();
  const [selectedCaseIds, setSelectedCaseIds] = useState<Record<string, string>>(
    {}
  );

  const signedRequests = useMemo(
    () => requests.filter((req) => req.clientSigned && req.sentToLawyerAt),
    [requests]
  );

  const pendingSend = useMemo(
    () => requests.filter((req) => req.clientSigned && !req.sentToLawyerAt),
    [requests]
  );

  return (
    <LawyerLayout
      brandTitle="LawFlow"
      brandSubtitle="Signatures"
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-emerald-100 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Client Signed Documents
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Review signed documents and attach them to the correct case file.
          </p>
        </div>

        {pendingSend.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-medium text-amber-800">
              {pendingSend.length} signed document{pendingSend.length !== 1 ? "s" : ""} waiting to be sent by the client.
            </p>
          </div>
        )}

        {signedRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            No signed documents received yet.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {signedRequests.map((req) => {
              const selectedCaseId =
                selectedCaseIds[req.id] || String(req.caseId || lawyerDashboardCases[0]?.id || 1);

              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {req.docTitle}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Signed by {req.clientSignatureName || "Client"} •{" "}
                        {req.clientSignedAt ? new Date(req.clientSignedAt).toLocaleString() : "Recently"}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Signed
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Attach to case
                    </label>
                    <select
                      value={selectedCaseId}
                      onChange={(event) =>
                        setSelectedCaseIds((prev) => ({
                          ...prev,
                          [req.id]: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      {lawyerDashboardCases.map((caseItem) => (
                        <option key={caseItem.id} value={caseItem.id}>
                          {caseItem.caseNumber} • {caseItem.title}
                        </option>
                      ))}
                    </select>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          updateRequest(req.id, {
                            caseId: selectedCaseId,
                          });
                          navigate({ to: `/lawyer-case-editor/${selectedCaseId}` });
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-3 py-2 text-xs font-semibold text-white hover:bg-[#024a23]"
                      >
                        <FileText className="h-4 w-4" />
                        Open Case Editor
                      </button>

                      <button
                        onClick={() => {
                          updateRequest(req.id, {
                            caseId: selectedCaseId,
                          });
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                      >
                        <Send className="h-4 w-4" />
                        Attach to Case
                      </button>

                      {req.signedAttachmentId && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">
                          Attached
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </LawyerLayout>
  );
}
