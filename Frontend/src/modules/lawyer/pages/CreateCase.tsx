import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Briefcase } from "lucide-react";
import LawyerLayout from "../components/LawyerLayout";
import {
  casesApi,
  getCasesErrorMessage,
  SUPPORTED_TEHSILS,
} from "../api/cases.api";
import { useNewCaseStore } from "../store/newCase.store";
import { useCaseFilingStore } from "../store/caseFiling.store";

export default function CreateCase() {
  const { selectedCaseType } = useNewCaseStore();
  const ensureCaseContext = useCaseFilingStore((state) => state.ensureCaseContext);
  const navigate = useNavigate();

  // If someone deep-links to /lawyer-create-case without first picking a case
  // type, bounce them back to the picker. Skipping this would let them submit
  // a form with no caseTypeId and get an opaque 422 from the backend.
  useEffect(() => {
    if (!selectedCaseType) {
      navigate({ to: "/lawyer-new-case" });
    }
  }, [selectedCaseType, navigate]);

  const [formData, setFormData] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    oppositeParty: "",
    caseTitle: "",
    description: "",
    assignedTehsil: "",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const createMutation = useMutation({
    mutationFn: casesApi.createCase,
    onSuccess: (created) => {
      // Mirror the backend case into the local filing store so the editor's
      // existing in-memory machinery (bundle items, signature requests) keeps
      // working. Phase 2 will replace that store with backend-backed queries.
      ensureCaseContext(created.id, created.title, {
        clientName: created.clientName,
        caseType: created.caseCategory,
      });
      // IMPORTANT: do NOT reset the new-case store here. Doing so nulls out
      // selectedCaseType and instantly trips the redirect useEffect below,
      // which fires before TanStack Router finishes the navigation to the
      // editor — bouncing the lawyer back to step 1. LawyerNewCase resets
      // its own store on mount, so the cleanup is already covered.
      navigate({
        to: "/lawyer-case-editor/$caseId",
        params: { caseId: created.id },
      });
    },
    onError: (error) => {
      setErrorMessage(getCasesErrorMessage(error));
    },
  });

  const handleCreateCase = () => {
    if (!selectedCaseType) return;
    setErrorMessage(null);

    createMutation.mutate({
      caseTypeId: selectedCaseType.id,
      title: formData.caseTitle.trim(),
      description: formData.description.trim() || undefined,
      clientName: formData.clientName.trim(),
      clientEmail: formData.clientEmail.trim() || undefined,
      clientPhone: formData.clientPhone.trim() || undefined,
      oppositePartyName: formData.oppositeParty.trim(),
      assignedTehsil: formData.assignedTehsil,
    });
  };

  return (
    <LawyerLayout
      brandTitle="LawFlow"
      brandSubtitle="Case Details"
    >
      <div className="max-w-3xl mx-auto">
        {/* Step indicator + header */}
        <div className="text-center space-y-2 mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            Step 3 of 3
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Case Details
          </h1>
          {selectedCaseType && (
            <p className="text-sm text-gray-600">
              {selectedCaseType.displayName} · {selectedCaseType.governingLaw}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 p-8">
          <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-gray-100">
            <Briefcase className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold tracking-tight text-gray-900">
              Client & Case Information
            </h2>
          </div>

          <div className="space-y-5">
            {/* Two-column grid for short fields */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1.5">
                  Client Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleInputChange}
                  placeholder="Enter client's full name"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1.5">
                  Client Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  name="clientEmail"
                  value={formData.clientEmail}
                  onChange={handleInputChange}
                  placeholder="client@example.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1.5">
                  Client Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  name="clientPhone"
                  value={formData.clientPhone}
                  onChange={handleInputChange}
                  placeholder="+92-300-XXXXXXX"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1.5">
                  Opposite Party / Respondent <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="oppositeParty"
                  value={formData.oppositeParty}
                  onChange={handleInputChange}
                  placeholder="Enter name of opposite party"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="assignedTehsil"
                  className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1.5"
                >
                  Court / Tehsil <span className="text-rose-500">*</span>
                </label>
                <select
                  id="assignedTehsil"
                  name="assignedTehsil"
                  value={formData.assignedTehsil}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none transition"
                >
                  <option value="" disabled>
                    Select the court / tehsil for this case
                  </option>
                  {SUPPORTED_TEHSILS.map((tehsil) => (
                    <option key={tehsil} value={tehsil}>
                      {tehsil}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-gray-500">
                  Routes the case to the registrar for this jurisdiction. Required
                  before the case can be submitted.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1.5">
                Case Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="caseTitle"
                value={formData.caseTitle}
                onChange={handleInputChange}
                placeholder="Brief, descriptive title for the case"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1.5">
                Case Description <span className="text-gray-400 font-normal normal-case">(optional)</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Background, facts, and any relevant context"
                rows={4}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] outline-none transition resize-none"
              />
            </div>
          </div>

          {/* Error from backend */}
          {errorMessage && (
            <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
            <button
              onClick={() => navigate({ to: "/lawyer-new-case" })}
              disabled={createMutation.isPending}
              className="flex-1 px-6 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-60"
            >
              Back
            </button>
            <button
              onClick={handleCreateCase}
              disabled={
                !formData.clientName ||
                !formData.clientEmail ||
                !formData.clientPhone ||
                !formData.oppositeParty ||
                !formData.caseTitle ||
                !formData.assignedTehsil ||
                createMutation.isPending
              }
              className="flex-1 px-6 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-semibold hover:bg-[#024A23] transition disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm shadow-green-100"
            >
              {createMutation.isPending ? "Creating…" : "Create Case & Open Editor"}
            </button>
          </div>
        </div>
      </div>
    </LawyerLayout>
  );
}
