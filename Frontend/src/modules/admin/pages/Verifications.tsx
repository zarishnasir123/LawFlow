import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  IdCard,
  ImageOff,
  Search,
  ShieldCheck,
} from "lucide-react";

import { AdminHeader } from "../components/AdminHeader";
import LogoutConfirmationModal from "../components/modals/LogoutConfirmationModal";
import { useAdminNotificationsStore } from "../store/notifications.store";
import {
  fetchPendingLawyers,
  reviewLawyer,
  type PendingLawyer,
  type LawyerDocumentType,
} from "../api/lawyerVerifications";
import { clearStoredAuth } from "../../auth/utils/authStorage";
import { getAuthErrorMessage } from "../../auth/api";

type VerificationMethod = "sjp" | "license";

type LawyerVerificationGate = {
  sjpChecked: boolean;
  licenseNumberChecked: boolean;
  licenseCardMatched: boolean;
  remarks: string;
};

const defaultGate: LawyerVerificationGate = {
  sjpChecked: false,
  licenseNumberChecked: false,
  licenseCardMatched: false,
  remarks: "",
};

const documentLabels: Record<LawyerDocumentType, string> = {
  law_degree: "Law Degree",
  bar_license_card: "Bar License Card",
  bar_license_card_front: "Bar License Card (Front)",
  bar_license_card_back: "Bar License Card (Back)",
};

function formatBytes(bytes: number | null) {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSubmittedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function lawyerDisplayName(lawyer: PendingLawyer) {
  return (
    [lawyer.firstName, lawyer.lastName].filter(Boolean).join(" ") || lawyer.email
  );
}

export default function Verifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<VerificationMethod>("sjp");
  const [gateByLawyer, setGateByLawyer] = useState<
    Record<string, LawyerVerificationGate>
  >({});

  const addLawyerVerificationNotification = useAdminNotificationsStore(
    (state) => state.addLawyerVerificationNotification,
  );

  const pendingQuery = useQuery({
    queryKey: ["admin", "pending-lawyers"],
    queryFn: () => fetchPendingLawyers({ limit: 50 }),
  });

  const reviewMutation = useMutation({
    mutationFn: reviewLawyer,
    onSuccess: (data) => {
      const fullName =
        [data.lawyer.firstName, data.lawyer.lastName].filter(Boolean).join(" ") ||
        data.lawyer.email;

      addLawyerVerificationNotification({
        lawyerName: fullName,
        decision: data.lawyer.verificationStatus === "approved" ? "approved" : "returned",
      });

      queryClient.invalidateQueries({ queryKey: ["admin", "pending-lawyers"] });
    },
  });

  const lawyers = pendingQuery.data?.items ?? [];

  const filteredLawyers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return lawyers;
    return lawyers.filter((lawyer) => {
      const name = lawyerDisplayName(lawyer).toLowerCase();
      const license = lawyer.barLicenseNumber.toLowerCase();
      return (
        name.includes(keyword) ||
        lawyer.email.toLowerCase().includes(keyword) ||
        license.includes(keyword)
      );
    });
  }, [lawyers, search]);

  const getGate = (id: string): LawyerVerificationGate =>
    gateByLawyer[id] ?? defaultGate;

  const setGate = (id: string, patch: Partial<LawyerVerificationGate>) => {
    setGateByLawyer((prev) => ({
      ...prev,
      [id]: { ...getGate(id), ...patch },
    }));
  };

  const canApprove = (gate: LawyerVerificationGate) =>
    method === "sjp"
      ? gate.sjpChecked
      : gate.licenseNumberChecked && gate.licenseCardMatched;

  const handleApprove = (lawyer: PendingLawyer) => {
    const gate = getGate(lawyer.lawyerProfileId);
    if (!canApprove(gate)) return;

    reviewMutation.mutate({
      lawyerProfileId: lawyer.lawyerProfileId,
      status: "approved",
      remarks: gate.remarks.trim() || undefined,
    });
  };

  const handleReject = (lawyer: PendingLawyer) => {
    const gate = getGate(lawyer.lawyerProfileId);
    if (!gate.remarks.trim()) {
      setGate(lawyer.lawyerProfileId, { remarks: gate.remarks });
      alert("Please add remarks before rejecting this lawyer.");
      return;
    }

    reviewMutation.mutate({
      lawyerProfileId: lawyer.lawyerProfileId,
      status: "rejected",
      remarks: gate.remarks.trim(),
    });
  };

  const handleLogout = () => {
    clearStoredAuth();
    setLogoutModalOpen(false);
    navigate({ to: "/login" });
  };

  const isMutating = reviewMutation.isPending;

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
          onOpenNotifications={() => navigate({ to: "/admin-notifications" })}
          onLogout={() => setLogoutModalOpen(true)}
        />

        <div className="w-full px-6 lg:px-8 xl:px-10 py-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            <section className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
              <h1 className="mt-3 text-2xl font-bold text-[#01411C]">
                Verify Lawyer Registrations
              </h1>
              <p className="mt-2 text-sm text-gray-600 max-w-4xl">
                Review every pending lawyer below. Confirm their credentials by
                either looking them up on the SJP directory or manually verifying
                their Bar Council license number against the uploaded card.
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
                      window.open(
                        "https://sjp.com.pk/",
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#01411C] bg-white px-4 py-2.5 text-sm font-semibold text-[#01411C] hover:bg-green-50"
                  >
                    Open SJP Directory
                    <ExternalLink className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </section>

            {reviewMutation.isError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {getAuthErrorMessage(reviewMutation.error)}
              </div>
            ) : null}

            <section className="space-y-4">
              {pendingQuery.isLoading ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-600">
                  Loading pending lawyer verifications…
                </div>
              ) : pendingQuery.isError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                  Could not load pending lawyers: {getAuthErrorMessage(pendingQuery.error)}
                </div>
              ) : filteredLawyers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-600">
                  No lawyer verification requests found.
                </div>
              ) : (
                filteredLawyers.map((lawyer) => {
                  const gate = getGate(lawyer.lawyerProfileId);
                  const fullName = lawyerDisplayName(lawyer);
                  const approveAllowed = canApprove(gate) && !isMutating;
                  const rejectAllowed = !isMutating;

                  return (
                    <article
                      key={lawyer.lawyerProfileId}
                      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                    >
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-lg font-semibold text-gray-900">
                              {fullName}
                            </h2>
                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              Lawyer
                            </span>
                            <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-yellow-100 text-yellow-700">
                              Pending
                            </span>
                            <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-700">
                              {lawyer.specialization}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-gray-600">{lawyer.email}</p>
                          {lawyer.phone ? (
                            <p className="mt-1 text-sm text-gray-600">{lawyer.phone}</p>
                          ) : null}
                          <p className="mt-1 text-sm text-gray-600">
                            CNIC: <span className="font-mono">{lawyer.cnic}</span>
                          </p>
                          <p className="mt-1 text-sm text-gray-600">
                            Submitted: {formatSubmittedAt(lawyer.submittedAt)}
                          </p>
                          {lawyer.cnicMatchRemarks ? (
                            <p className="mt-2 text-xs text-gray-500">
                              {lawyer.cnicMatchRemarks}
                            </p>
                          ) : null}
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm">
                          <p className="font-semibold text-gray-900">
                            Bar Council License No.
                          </p>
                          <p className="font-mono text-[#01411C]">
                            {lawyer.barLicenseNumber}
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {lawyer.districtBar}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 rounded-lg border border-gray-200 p-4">
                        <h3 className="text-sm font-semibold text-gray-900">
                          Submitted Documents
                        </h3>
                        {lawyer.documents.length === 0 ? (
                          <p className="mt-2 text-xs text-gray-500">
                            No documents recorded for this submission.
                          </p>
                        ) : (
                          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                            {lawyer.documents.map((doc) => {
                              const label = documentLabels[doc.documentType] ?? doc.documentType;
                              const isImage = doc.mimeType?.startsWith("image/");
                              const isPdf = doc.mimeType === "application/pdf";

                              return (
                                <li
                                  key={`${lawyer.lawyerProfileId}-${doc.documentType}`}
                                  className="flex flex-col gap-3 rounded-md border border-gray-100 bg-gray-50 p-3"
                                >
                                  <div className="flex items-start gap-2">
                                    <FileText className="mt-0.5 h-4 w-4 text-[#01411C]" />
                                    <div className="min-w-0 flex-1 text-xs text-gray-700">
                                      <p className="font-semibold text-gray-900">{label}</p>
                                      <p
                                        className="truncate text-gray-600"
                                        title={doc.fileName ?? ""}
                                      >
                                        {doc.fileName ?? "(no filename)"}
                                      </p>
                                      <p className="text-gray-500">
                                        {doc.mimeType ?? "unknown"} · {formatBytes(doc.fileSize)}
                                      </p>
                                    </div>
                                  </div>

                                  {doc.previewUrl ? (
                                    isImage ? (
                                      <a
                                        href={doc.previewUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block overflow-hidden rounded-md border border-gray-200 bg-white"
                                      >
                                        <img
                                          src={doc.previewUrl}
                                          alt={`${label} preview`}
                                          className="max-h-40 w-full object-contain"
                                          loading="lazy"
                                        />
                                      </a>
                                    ) : isPdf ? (
                                      <a
                                        href={doc.previewUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-[#01411C] bg-white px-3 py-2 text-xs font-semibold text-[#01411C] hover:bg-green-50"
                                      >
                                        View document
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    ) : (
                                      <a
                                        href={doc.previewUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-semibold text-[#01411C] hover:underline"
                                      >
                                        Open file
                                      </a>
                                    )
                                  ) : (
                                    <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 bg-white px-3 py-2 text-xs text-gray-500">
                                      <ImageOff className="h-4 w-4" />
                                      Preview unavailable — storage not configured.
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
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
                                setGate(lawyer.lawyerProfileId, {
                                  sjpChecked: !gate.sjpChecked,
                                })
                              }
                              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                                gate.sjpChecked
                                  ? "bg-green-100 text-green-700"
                                  : "bg-[#01411C] text-white hover:bg-[#025227]"
                              }`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {gate.sjpChecked ? "SJP Checked" : "Mark as Checked"}
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
                                checked={gate.licenseNumberChecked}
                                onChange={(e) =>
                                  setGate(lawyer.lawyerProfileId, {
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
                                checked={gate.licenseCardMatched}
                                onChange={(e) =>
                                  setGate(lawyer.lawyerProfileId, {
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
                          value={gate.remarks}
                          onChange={(e) =>
                            setGate(lawyer.lawyerProfileId, { remarks: e.target.value })
                          }
                          rows={3}
                          placeholder="Required when rejecting; optional when approving."
                          className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-600"
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={!approveAllowed}
                          onClick={() => handleApprove(lawyer)}
                          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                            approveAllowed
                              ? "bg-[#01411C] text-white hover:bg-[#025227]"
                              : "cursor-not-allowed bg-gray-200 text-gray-500"
                          }`}
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Approve Lawyer
                        </button>

                        <button
                          type="button"
                          disabled={!rejectAllowed}
                          onClick={() => handleReject(lawyer)}
                          className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Reject Lawyer
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
