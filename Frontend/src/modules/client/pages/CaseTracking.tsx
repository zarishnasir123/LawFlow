import { useNavigate, useSearch } from "@tanstack/react-router";
import { CalendarClock, FileSignature } from "lucide-react";
import ClientLayout from "../components/ClientLayout";
import Card from "../../../shared/components/dashboard/Card";
import { caseInfo, timeline } from "../data/casetrack.mock";
import { useSignatureRequestsStore } from "../../lawyer/signatures/store/signatureRequests.store";

function Badge({ text, color }: { text: string; color?: string }) {
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-1 rounded-md ${
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
  const { view, caseId } = useSearch({ strict: false }) as {
    view?: string;
    caseId?: string;
  };
  const isPendingView = view === "pending";
  const signatureCaseId = caseId || "default-case";

  const { getPendingRequests, getCompletedRequests } = useSignatureRequestsStore();

  const pendingRequests = getPendingRequests(signatureCaseId);
  const completedRequests = getCompletedRequests(signatureCaseId);

  const statusColors: Record<string, string> = {
    Completed: "border-green-500 text-green-700 bg-green-50",
    "In Progress": "border-blue-500 text-blue-700 bg-blue-50",
    Pending: "border-gray-400 text-gray-600 bg-gray-50",
  };

  return (
    <ClientLayout
      brandSubtitle={isPendingView ? "Pending Signatures" : "Case Tracking"}
      showBackButton
      onBackClick={() => navigate({ to: "/client-dashboard" })}
    >
      <div className="space-y-6">
        {!isPendingView && (
          <>
            {/* --- Case Info --- */}
            <Card className="p-6 border border-green-100 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                {caseInfo.caseNumber}{" "}
                <Badge
                  text={caseInfo.status}
                  color="bg-purple-100 text-purple-700"
                />
              </h2>
              <p className="text-gray-700 mb-4">{caseInfo.title}</p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Category</p>
                  <p className="font-medium">{caseInfo.category}</p>
                </div>
                <div>
                  <p className="text-gray-500">Filed Date</p>
                  <p className="font-medium">{caseInfo.filedDate}</p>
                </div>
                <div>
                  <p className="text-gray-500">Client</p>
                  <p className="font-medium">{caseInfo.client}</p>
                </div>
                <div>
                  <p className="text-gray-500">Lawyer</p>
                  <p className="font-medium">{caseInfo.lawyer}</p>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* --- Pending Signatures --- */}
        <Card className="p-6 border border-amber-100/80 bg-gradient-to-br from-white via-amber-50/30 to-white shadow-[0_18px_45px_-32px_rgba(120,53,15,0.35)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                Signature queue
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">
                Pending Signatures
              </h3>
            </div>
            <Badge
              text={`${pendingRequests.length} Pending`}
              color="bg-amber-100 text-amber-800"
            />
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
                      <p className="text-sm font-semibold text-gray-900">
                        {doc.docTitle}
                      </p>
                      <p className="text-xs text-gray-500">
                        {caseInfo.caseNumber} • Sent by {doc.requestedBy || "Lawyer"}
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
                    <Badge
                      text="Pending Signature"
                      color="bg-amber-100 text-amber-700"
                    />
                    <button
                      onClick={() =>
                        navigate({ to: `/client-signatures/${doc.id}` })
                      }
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
          <Card className="p-6 border border-emerald-100/80 bg-gradient-to-br from-white via-emerald-50/40 to-white shadow-[0_18px_45px_-32px_rgba(16,185,129,0.4)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                  Completed
                </p>
                <h3 className="mt-1 text-lg font-semibold text-gray-900">
                  Signed Documents
                </h3>
              </div>
              <Badge
                text={`${completedRequests.length} Signed`}
                color="bg-emerald-100 text-emerald-700"
              />
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
                      <p className="text-sm font-semibold text-gray-900">
                        {doc.docTitle}
                      </p>
                      <p className="text-xs text-gray-500">
                        Signed by {doc.clientSignatureName || "Client"}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Signed {formatDateTime(doc.clientSignedAt)}
                      </p>
                    </div>
                  </div>
                  <Badge
                    text="Signed"
                    color="bg-emerald-100 text-emerald-700"
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        {!isPendingView && (
          <>
            {/* --- Case Timeline --- */}
            <Card className="p-6 border border-gray-100 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Case Timeline
              </h3>

              <div className="space-y-4">
                {timeline.map((step, i) => (
                  <div
                    key={i}
                    className="relative flex items-start gap-4 border border-gray-200 rounded-lg p-4"
                  >
                    {/* Timeline Icon */}
                    <div
                      className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full ${
                        step.status === "Completed"
                          ? "bg-green-100 text-green-700"
                          : step.status === "In Progress"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <step.icon className="h-4 w-4" />
                    </div>

                    {/* Timeline Content */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">{step.title}</h4>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-md border ${statusColors[step.status]}`}
                        >
                          {step.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {step.description}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {step.date} - {step.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </ClientLayout>
  );
}
