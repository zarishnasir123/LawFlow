import { useMemo } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { CalendarClock, FileSignature } from "lucide-react";
import ClientLayout from "../components/ClientLayout";
import Card from "../../../shared/components/dashboard/Card";
import { useSignatureRequestsStore } from "../../lawyer/signatures/store/signatureRequests.store";
import { useCaseFilingStore } from "../../lawyer/store/caseFiling.store";
import { getCaseDisplayTitle } from "../../../shared/utils/caseDisplay";

function Badge({ text, color }: { text: string; color?: string }) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${
        color || "bg-gray-100 text-gray-600"
      }`}
    >
      {text}
    </span>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateOnly(value?: string) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function CaseTracking() {
  const navigate = useNavigate();
  const { caseId } = useSearch({ strict: false }) as {
    caseId?: string;
  };
  const signatureCaseId = caseId || "default-case";

  const { getPendingRequests, getCompletedRequests } = useSignatureRequestsStore();
  const filingCases = useCaseFilingStore((state) => state.cases);

  const pendingRequests = useMemo(
    () => (caseId ? getPendingRequests(signatureCaseId) : getPendingRequests()),
    [caseId, getPendingRequests, signatureCaseId]
  );
  const completedRequests = useMemo(
    () => (caseId ? getCompletedRequests(signatureCaseId) : getCompletedRequests()),
    [caseId, getCompletedRequests, signatureCaseId]
  );

  const caseTitleById = useMemo(
    () =>
      new Map(
        filingCases.map(
          (item) => [item.id, getCaseDisplayTitle(item.title, item.id)] as const
        )
      ),
    [filingCases]
  );

  return (
    <ClientLayout
      brandSubtitle="Pending Signatures"
      showBackButton
      onBackClick={() => navigate({ to: "/client-dashboard" })}
    >
      <div className="space-y-6">
        <Card className="border border-amber-100/80 bg-gradient-to-br from-white via-amber-50/30 to-white p-6 shadow-[0_18px_45px_-32px_rgba(120,53,15,0.35)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                Signature queue
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">Pending Signatures</h3>
            </div>
            <Badge text={`${pendingRequests.length} Pending`} color="bg-amber-100 text-amber-800" />
          </div>

          {pendingRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-amber-200/70 bg-white/70 p-6 text-center text-sm text-gray-600">
              No documents are waiting for your signature right now.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-100 bg-white p-4 shadow-[0_10px_25px_-22px_rgba(120,53,15,0.4)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-amber-50 p-2 text-amber-700 shadow-sm">
                      <FileSignature className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{doc.docTitle}</p>
                      <p className="text-xs text-gray-500">
                        {caseTitleById.get(doc.caseId) || "Case File"} • Sent by {doc.requestedBy || "Lawyer"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Requested {formatDateTime(doc.requestedAt)}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span>Due {formatDateOnly(doc.dueAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge text="Pending Signature" color="bg-amber-100 text-amber-700" />
                    <button
                      onClick={() => navigate({ to: `/client-signatures/${doc.id}` })}
                      className="rounded-lg border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {completedRequests.length > 0 && (
          <Card className="border border-emerald-100/80 bg-gradient-to-br from-white via-emerald-50/40 to-white p-6 shadow-[0_18px_45px_-32px_rgba(16,185,129,0.4)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                  Completed
                </p>
                <h3 className="mt-1 text-lg font-semibold text-gray-900">Signed Documents</h3>
              </div>
              <Badge text={`${completedRequests.length} Signed`} color="bg-emerald-100 text-emerald-700" />
            </div>
            <div className="space-y-3">
              {completedRequests.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-emerald-100 bg-white p-4 shadow-[0_10px_25px_-22px_rgba(16,185,129,0.35)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-emerald-50 p-2 text-emerald-600 shadow-sm">
                      <FileSignature className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{doc.docTitle}</p>
                      <p className="text-xs text-gray-500">Signed by {doc.clientSignatureName || "Client"}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Signed {formatDateTime(doc.clientSignedAt)}
                      </p>
                    </div>
                  </div>
                  <Badge text="Signed" color="bg-emerald-100 text-emerald-700" />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </ClientLayout>
  );
}
