import { useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import LawyerLayout from "../components/LawyerLayout";
import { casesApi } from "../api/cases.api";
import { useNewCaseStore } from "../store/newCase.store";

export default function LawyerNewCase() {
  const navigate = useNavigate();
  const { category, selectedCaseType, setCategory, setSelectedCaseType, reset } =
    useNewCaseStore();

  // Reset store on component mount to start fresh
  useEffect(() => {
    reset();
  }, [reset]);

  // Case types come from the backend (seeded in case_types). staleTime of an
  // hour because the catalog is effectively static — adding a new type is a
  // schema change, not a runtime update.
  const {
    data: allTypes = [],
    isLoading: caseTypesLoading,
    isError: caseTypesError,
  } = useQuery({
    queryKey: ["caseTypes"],
    queryFn: casesApi.listCaseTypes,
    staleTime: 1000 * 60 * 60,
  });

  const handleCategorySelect = (selectedCategory: "civil" | "family") => {
    setCategory(selectedCategory);
    setSelectedCaseType(null);
  };

  const handleCaseTypeSelect = (caseTypeId: string) => {
    const selected = allTypes.find((ct) => ct.id === caseTypeId);
    if (selected) {
      setSelectedCaseType(selected);
    }
  };

  const caseTypes = useMemo(
    () => allTypes.filter((ct) => ct.category === category),
    [allTypes, category]
  );

  return (
    <LawyerLayout
      brandTitle="LawFlow"
      brandSubtitle="Create New Case"
    >
      <div className="w-full max-w-5xl mx-auto">
        {/* Step 1: Category Selection */}
        {!category ? (
          <div className="space-y-12">
            <div className="text-center space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                Step 1 of 3
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                Select Case Category
              </h1>
              <p className="text-base leading-relaxed text-gray-600">
                Choose the type of case you want to create
              </p>
            </div>

            {/* Category Cards */}
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Civil Case Card */}
              <button
                onClick={() => handleCategorySelect("civil")}
                className="text-left p-8 rounded-2xl border border-gray-200 hover:border-green-500 hover:shadow-xl hover:shadow-green-100 bg-white transition-all duration-300 group transform hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-100 to-green-200 group-hover:from-green-200 group-hover:to-green-300 flex items-center justify-center transition transform group-hover:scale-105">
                    <span className="text-3xl">⚖️</span>
                  </div>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900 group-hover:text-green-700 transition mb-2">
                  Civil Case
                </h2>
                <p className="text-sm leading-relaxed text-gray-600">
                  Cases related to civil disputes, property matters, contracts, and other civil litigation.
                </p>
              </button>

              {/* Family Case Card */}
              <button
                onClick={() => handleCategorySelect("family")}
                className="text-left p-8 rounded-2xl border border-gray-200 hover:border-purple-500 hover:shadow-xl hover:shadow-purple-100 bg-white transition-all duration-300 group transform hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-200 group-hover:from-purple-200 group-hover:to-purple-300 flex items-center justify-center transition transform group-hover:scale-105">
                    <span className="text-3xl">👨‍👩‍👧</span>
                  </div>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900 group-hover:text-purple-700 transition mb-2">
                  Family Case
                </h2>
                <p className="text-sm leading-relaxed text-gray-600">
                  Cases related to family law, divorce, custody, maintenance, and other family matters.
                </p>
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Case Type Selection */
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                Step 2 of 3
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                {category && (category as "civil" | "family") === "civil" ? "Civil" : "Family"} Case Types
              </h1>
              <p className="text-base leading-relaxed text-gray-600">
                Select the specific type of case you're handling
              </p>
            </div>

            {/* Case Type List */}
            {caseTypesLoading && (
              <div className="text-center text-sm text-gray-500 py-12">
                Loading case types…
              </div>
            )}

            {caseTypesError && (
              <div className="text-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl py-6 px-4">
                Could not load case types. Please refresh the page.
              </div>
            )}

            <div className="space-y-2.5">
              {!caseTypesLoading && !caseTypesError && caseTypes.map((caseType) => (
                <button
                  key={caseType.id}
                  onClick={() => handleCaseTypeSelect(caseType.id)}
                  className={`w-full text-left p-5 rounded-xl border transition-all duration-200 ${
                    selectedCaseType?.id === caseType.id
                      ? (category as "civil" | "family") === "civil"
                        ? "border-green-500 bg-green-50 shadow-md shadow-green-100"
                        : "border-purple-500 bg-purple-50 shadow-md shadow-purple-100"
                      : "border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`font-semibold text-[15px] tracking-tight transition ${
                          selectedCaseType?.id === caseType.id
                            ? (category as "civil" | "family") === "civil"
                              ? "text-green-700"
                              : "text-purple-700"
                            : "text-gray-900"
                        }`}
                      >
                        {caseType.displayName}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                        {caseType.governingLaw}
                      </p>
                    </div>
                    {selectedCaseType?.id === caseType.id && (
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          category === "civil"
                            ? "bg-green-600"
                            : "bg-purple-600"
                        }`}
                      >
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            {selectedCaseType && (
              <div className="flex gap-3 pt-6 border-t border-gray-200">
                <button
                  onClick={reset}
                  className="flex-1 px-6 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    navigate({ to: "/lawyer-create-case" });
                  }}
                  className={`flex-1 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition ${
                    category === "civil"
                      ? "bg-green-600 hover:bg-green-700 shadow-md shadow-green-200"
                      : "bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200"
                  }`}
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </LawyerLayout>
  );
}
