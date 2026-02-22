import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  ExternalLink,
  Globe,
  IdCard,
  Search,
  ShieldCheck,
} from "lucide-react";

import { AdminHeader } from "../components/AdminHeader";
import LogoutConfirmationModal from "../components/modals/LogoutConfirmationModal";
import { adminPendingVerifications } from "../dashboard.mock";

type VerificationStage = "pending" | "approved" | "returned";
type VerificationMethod = "sjp" | "license";

type LawyerVerificationState = {
  sjpChecked: boolean;
  licenseNumberChecked: boolean;
  licenseCardMatched: boolean;
  remarks: string;
  stage: VerificationStage;
};

export default function Verifications() {
  const navigate = useNavigate();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<VerificationMethod>("sjp");

  const lawyers = useMemo(
    () => adminPendingVerifications.filter((item) => item.type === "Lawyer"),
    [],
  );

  const [verificationMap, setVerificationMap] = useState<
    Record<number, LawyerVerificationState>
  >(() =>
    lawyers.reduce<Record<number, LawyerVerificationState>>((acc, lawyer) => {
      acc[lawyer.id] = {
        sjpChecked: false,
        licenseNumberChecked: false,
        licenseCardMatched: false,
        remarks: "",
        stage: "pending",
      };
      return acc;
    }, {}),
  );

  const filteredLawyers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return lawyers;

    return lawyers.filter((lawyer) => {
      const license = lawyer.barCouncilLicenseNumber?.toLowerCase() ?? "";
      return (
        lawyer.name.toLowerCase().includes(keyword) ||
        lawyer.email.toLowerCase().includes(keyword) ||
        license.includes(keyword)
      );
    });
  }, [lawyers, search]);

  const handleLogout = () => {
    localStorage.clear();
    setLogoutModalOpen(false);
    navigate({ to: "/login" });
  };

  const updateLawyerState = (
    id: number,
    patch: Partial<LawyerVerificationState>,
  ) => {
    setVerificationMap((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...patch,
      },
    }));
  };

  const canApprove = (
    state: LawyerVerificationState,
    selectedMethod: VerificationMethod,
  ) => {
    if (selectedMethod === "sjp") {
      return state.sjpChecked;
    }

    return state.licenseNumberChecked && state.licenseCardMatched;
  };

  return (
    <>
      <LogoutConfirmationModal
        open={logoutModalOpen}
        onCancel={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
      />

      <div className="min-h-screen bg-gray-50">
        <AdminHeader
          title="Verify Lawyers"
          subtitle="Lawyer Verification"
          notificationCount={3}
          onOpenNotifications={() => navigate({ to: "/admin-notifications" })}
          onOpenProfile={() => navigate({ to: "/admin-profile" })}
          onLogout={() => setLogoutModalOpen(true)}
        />

        <div className="w-full px-6 lg:px-8 xl:px-10 py-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">
          <section className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
            <h1 className="mt-3 text-2xl font-bold text-[#01411C]">
              Verify Lawyer Registrations
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-4xl">
              Select one verification method. Admin can verify lawyer by checking
              SJP lawyer listing or by manual Bar Council license validation.
            </p>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Verification Method
            </h2>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMethod("sjp")}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  method === "sjp"
                    ? "border-green-400 bg-green-50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-[#01411C]" />
                  <span className="font-semibold text-gray-900">
                    Verify via SJP Website
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  Cross-check lawyer profile in SJP Lawyers Directory.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMethod("license")}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  method === "license"
                    ? "border-green-400 bg-green-50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <IdCard className="h-4 w-4 text-[#01411C]" />
                  <span className="font-semibold text-gray-900">
                    Verify via Bar Council License
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  Manually verify license number and uploaded license card.
                </p>
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="w-full md:max-w-md">
                <label htmlFor="lawyerSearch" className="sr-only">
                  Search lawyer
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="lawyerSearch"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by lawyer name, email, or license number"
                    className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-green-600"
                  />
                </div>
              </div>

              {method === "sjp" ? (
                <button
                  type="button"
                  onClick={() =>
                    window.open("https://sjp.com.pk/", "_blank", "noopener,noreferrer")
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#01411C] bg-white px-4 py-2.5 text-sm font-semibold text-[#01411C] hover:bg-green-50"
                >
                  Open SJP Directory
                  <ExternalLink className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </section>

          <section className="space-y-4">
            {filteredLawyers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-600">
                No lawyer verification requests found.
              </div>
            ) : (
              filteredLawyers.map((lawyer) => {
                const state = verificationMap[lawyer.id];

                return (
                  <article
                    key={lawyer.id}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-lg font-semibold text-gray-900">
                            {lawyer.name}
                          </h2>
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            Lawyer
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              state.stage === "approved"
                                ? "bg-green-100 text-green-700"
                                : state.stage === "returned"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {state.stage === "approved"
                              ? "Approved"
                              : state.stage === "returned"
                                ? "Returned"
                                : "Pending"}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-gray-600">{lawyer.email}</p>
                        <p className="mt-1 text-sm text-gray-600">
                          Submitted: {lawyer.submitted}
                        </p>
                      </div>

                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm">
                        <p className="font-semibold text-gray-900">
                          Bar Council License No.
                        </p>
                        <p className="font-mono text-[#01411C]">
                          {lawyer.barCouncilLicenseNumber ?? "Not Provided"}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {lawyer.licenseIssuingAuthority ?? "Authority Pending"}
                        </p>
                      </div>
                    </div>

                    {method === "sjp" ? (
                      <div className="mt-5 rounded-lg border border-gray-200 p-4">
                        <h3 className="text-sm font-semibold text-gray-900">
                          SJP Verification
                        </h3>
                        <p className="mt-1 text-xs text-gray-600">
                          Open SJP and confirm lawyer listing by name and type.
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                "https://sjp.com.pk/",
                                "_blank",
                                "noopener,noreferrer",
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                          >
                            Open SJP
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateLawyerState(lawyer.id, {
                                sjpChecked: !state.sjpChecked,
                              })
                            }
                            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                              state.sjpChecked
                                ? "bg-green-100 text-green-700"
                                : "bg-[#01411C] text-white hover:bg-[#025227]"
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {state.sjpChecked ? "SJP Checked" : "Mark as Checked"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-lg border border-gray-200 p-4">
                        <h3 className="text-sm font-semibold text-gray-900">
                          Bar Council License Verification
                        </h3>
                        <p className="mt-1 text-xs text-gray-600">
                          Verify license number and uploaded license card manually.
                        </p>
                        <div className="mt-3 flex flex-col gap-2">
                          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={state.licenseNumberChecked}
                              onChange={(e) =>
                                updateLawyerState(lawyer.id, {
                                  licenseNumberChecked: e.target.checked,
                                })
                              }
                              className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-600"
                            />
                            License number verified manually
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={state.licenseCardMatched}
                              onChange={(e) =>
                                updateLawyerState(lawyer.id, {
                                  licenseCardMatched: e.target.checked,
                                })
                              }
                              className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-600"
                            />
                            Uploaded license card matched
                          </label>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Review Remarks
                      </label>
                      <textarea
                        value={state.remarks}
                        onChange={(e) =>
                          updateLawyerState(lawyer.id, { remarks: e.target.value })
                        }
                        rows={3}
                        placeholder="Add remarks for approval or return decision..."
                        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-600"
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={!canApprove(state, method)}
                        onClick={() =>
                          updateLawyerState(lawyer.id, { stage: "approved" })
                        }
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                          canApprove(state, method)
                            ? "bg-[#01411C] text-white hover:bg-[#025227]"
                            : "cursor-not-allowed bg-gray-200 text-gray-500"
                        }`}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Approve Lawyer
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateLawyerState(lawyer.id, { stage: "returned" })
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        Return for Correction
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>
          </div>
        </div>
      </div>
    </>
  );
}
