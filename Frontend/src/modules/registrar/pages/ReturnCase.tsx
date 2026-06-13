import { useForm } from "react-hook-form";
import { ArrowLeft, XCircle } from "lucide-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import RegistrarLayout from "../components/RegistrarLayout";
import Card from "../../../shared/components/dashboard/Card";
import { getCaseDisplayTitle } from "../../../shared/utils/caseDisplay";
import { getCase, getRegistrarErrorMessage, returnCase } from "../api";

type ReturnFormValues = {
  remarks: string;
};

export default function ReturnCase() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { caseId } = useSearch({ from: "/return-case" });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ReturnFormValues>({ defaultValues: { remarks: "" } });

  const { data: caseData } = useQuery({
    queryKey: ["registrar", "cases", caseId],
    queryFn: () => getCase(caseId as string),
    enabled: Boolean(caseId),
  });

  const returnMutation = useMutation({
    mutationFn: (remarks: string) => returnCase(caseId as string, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrar", "cases"] });
      navigate({ to: "/view-cases" });
    },
    onError: (error) => {
      setError("remarks", { message: getRegistrarErrorMessage(error) });
    },
  });

  const onSubmit = handleSubmit((values) => {
    const trimmed = values.remarks.trim();
    if (!trimmed) {
      setError("remarks", { message: "Remarks are required to return a case." });
      return;
    }
    returnMutation.mutate(trimmed);
  });

  // Reached without a target case (e.g. a stale bookmark). Send the
  // registrar back to the queue rather than rendering a dead form.
  if (!caseId) {
    return (
      <RegistrarLayout pageSubtitle="Return Case">
        <Card className="p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <XCircle className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">No case selected</h2>
          <p className="mt-1 text-sm text-gray-500">
            Open a case from the review queue to return it for corrections.
          </p>
          <button
            onClick={() => navigate({ to: "/view-cases" })}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#025a27]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Queue
          </button>
        </Card>
      </RegistrarLayout>
    );
  }

  const caseTitleDisplay = getCaseDisplayTitle(caseData?.title, caseData?.id);

  return (
    <RegistrarLayout pageSubtitle="Return Case">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Card className="border-l-4 border-rose-500">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-600">
            Return for Corrections
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
            {caseData ? caseTitleDisplay : "Return Case"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Send this case back to the lawyer with specific correction remarks. The
            case returns to the lawyer for editing and resubmission, and stays
            tracked in your Returned Cases list.
          </p>
        </Card>

        <Card>
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-rose-700">
                Remarks for Lawyer <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={5}
                placeholder="Specify what needs to be corrected before resubmission..."
                className="w-full rounded-xl border border-rose-200 bg-white p-3 text-sm outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-300"
                {...register("remarks", {
                  required: "Remarks are required to return a case.",
                  validate: (value) =>
                    value.trim().length > 0 ||
                    "Remarks are required to return a case.",
                })}
              />
              {errors.remarks && (
                <p className="mt-2 text-sm text-rose-600">{errors.remarks.message}</p>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-5">
              <button
                type="button"
                onClick={() =>
                  navigate({
                    to: "/review-cases/$caseId",
                    params: { caseId },
                  })
                }
                disabled={returnMutation.isPending}
                className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Back to Review
              </button>
              <button
                type="submit"
                disabled={returnMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                {returnMutation.isPending ? "Returning…" : "Submit & Return Case"}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </RegistrarLayout>
  );
}
