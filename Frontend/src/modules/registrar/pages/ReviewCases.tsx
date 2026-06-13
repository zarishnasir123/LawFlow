import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  FileText,
  MapPinned,
  Scale,
  ShieldCheck,
  UserCircle2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import RegistrarLayout from "../components/RegistrarLayout";
import Card from "../../../shared/components/dashboard/Card";
import { getCaseDisplayTitle } from "../../../shared/utils/caseDisplay";
import { approveCase, getCase, getRegistrarErrorMessage } from "../api";

export default function ReviewCases() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { caseId } = useParams({ from: "/review-cases/$caseId" });
  const [action, setAction] = useState<"approve" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: caseData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["registrar", "cases", caseId],
    queryFn: () => getCase(caseId),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveCase(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrar", "cases"] });
      navigate({ to: "/view-cases" });
    },
    onError: (error) => setErrorMessage(getRegistrarErrorMessage(error)),
  });

  if (isLoading) {
    return (
      <RegistrarLayout pageSubtitle="Review Case">
        <div className="p-10 text-center text-gray-600">Loading case…</div>
      </RegistrarLayout>
    );
  }

  if (isError || !caseData) {
    return (
      <RegistrarLayout pageSubtitle="Review Case">
        <div className="p-10 text-center text-gray-600">
          Case not found in registrar queue.
        </div>
      </RegistrarLayout>
    );
  }

  const caseTitleDisplay = getCaseDisplayTitle(caseData.title, caseData.id);
  const isMutating = approveMutation.isPending;

  const handleConfirmApproval = () => {
    setErrorMessage(null);
    approveMutation.mutate();
  };

  return (
    <RegistrarLayout pageSubtitle="Review Case">
      <div className="mx-auto w-full max-w-[1280px] space-y-6 px-2">
        <Card className="border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/35 to-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                Registrar Review
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                {caseTitleDisplay}
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-600">
                Review the submitted case file, then approve or return for corrections.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                Pending Review
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
            Case Information
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
              <p className="text-xs text-gray-500">Case Title</p>
              <p className="mt-1 font-semibold text-gray-900">{caseTitleDisplay}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Lawyer</p>
              <p className="mt-1 inline-flex items-center gap-2 font-semibold text-gray-900">
                <UserCircle2 className="h-4 w-4 text-emerald-700" />
                {caseData.lawyerName}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Client</p>
              <p className="mt-1 inline-flex items-center gap-2 font-semibold text-gray-900">
                <UserCircle2 className="h-4 w-4 text-emerald-700" />
                {caseData.clientName}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Category</p>
              <p className="mt-1 inline-flex items-center gap-2 font-semibold capitalize text-gray-900">
                <Scale className="h-4 w-4 text-emerald-700" />
                {caseData.caseTypeLabel || caseData.category}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Tehsil</p>
              <p className="mt-1 inline-flex items-center gap-2 font-semibold text-gray-900">
                <MapPinned className="h-4 w-4 text-emerald-700" />
                {caseData.assignedTehsil || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Submitted At</p>
              <p className="mt-1 inline-flex items-center gap-2 font-semibold text-gray-900">
                <AlertCircle className="h-4 w-4 text-emerald-700" />
                {caseData.submittedAt
                  ? new Date(caseData.submittedAt).toLocaleString()
                  : "—"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="border border-emerald-100">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
            Signed Case File
          </h2>

          {caseData.signedPdfUrl ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3">
                <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800">
                  <FileText className="h-4 w-4" />
                  Signed PDF submitted by the lawyer
                </div>
                <a
                  href={caseData.signedPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#025a27]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in new tab
                </a>
              </div>
              <iframe
                title="Signed case file"
                src={caseData.signedPdfUrl}
                className="h-[720px] w-full rounded-xl border border-gray-200 bg-gray-50"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 px-4 py-6 text-sm text-amber-800">
              No signed PDF is available for this case yet.
            </div>
          )}
        </Card>

        <Card className="border border-emerald-100">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
            Review Decision
          </h2>

          {errorMessage && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          {!action ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
                <h3 className="text-base font-semibold text-gray-900">Approve Case</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Accept this submission so it can proceed to hearing scheduling.
                </p>
                <button
                  onClick={() => {
                    setErrorMessage(null);
                    setAction("approve");
                  }}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#01411C] py-2.5 text-sm font-semibold text-white hover:bg-[#025a27]"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Continue with Approval
                </button>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
                <h3 className="text-base font-semibold text-gray-900">Return for Corrections</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Send this case back to the lawyer with specific correction remarks.
                </p>
                <button
                  onClick={() =>
                    navigate({
                      to: "/return-case",
                      search: { caseId: caseData.id },
                    })
                  }
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  <XCircle className="h-4 w-4" />
                  Continue with Return
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Approve this case?</h3>
              <p className="mt-1 text-sm text-gray-600">
                The case will be accepted and removed from your review queue.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => setAction(null)}
                  disabled={isMutating}
                  className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmApproval}
                  disabled={isMutating}
                  className="rounded-lg bg-[#01411C] px-5 py-2 text-sm font-medium text-white hover:bg-[#025a27] disabled:opacity-50"
                >
                  {approveMutation.isPending ? "Approving…" : "Confirm Approval"}
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </RegistrarLayout>
  );
}
