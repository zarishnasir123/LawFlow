import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  Hash,
  IdCard,
  ImageOff,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  XCircle,
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

type LawyerVerificationGate = {
  licenseNumberChecked: boolean;
  licenseCardMatched: boolean;
  remarks: string;
};

const defaultGate: LawyerVerificationGate = {
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

function lawyerInitials(lawyer: PendingLawyer) {
  const first = lawyer.firstName?.[0] ?? "";
  const last = lawyer.lastName?.[0] ?? "";
  return ((first + last).toUpperCase() || lawyer.email[0]?.toUpperCase() || "?");
}

export default function Verifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [search, setSearch] = useState("");
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
      queryClient.invalidateQueries({ queryKey: ["admin", "lawyer-rejections"] });
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
    gate.licenseNumberChecked && gate.licenseCardMatched;

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
  const pendingCount = filteredLawyers.length;

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
            {/* Hero / Intro */}
            <section className="rounded-2xl border border-green-100 bg-gradient-to-br from-white via-white to-green-50/40 p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#01411C] text-white">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-[#01411C]">
                      Verify Lawyer Registrations
                    </h1>
                    <p className="mt-1 max-w-3xl text-sm text-gray-600">
                      Review every pending lawyer below. Verify their Bar Council
                      license number against the uploaded card. SJP cross-check is
                      optional and available at the bottom of this page.
                    </p>
                    <Link
                      to="/admin-rejection-history"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-rose-700 hover:underline"
                    >
                      View returned registration history
                    </Link>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {pendingQuery.isLoading
                    ? "Loading…"
                    : `${pendingCount} pending ${pendingCount === 1 ? "request" : "requests"}`}
                </div>
              </div>
            </section>

            {/* Search */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
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
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                />
              </div>
            </section>

            {reviewMutation.isError ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{getAuthErrorMessage(reviewMutation.error)}</span>
              </div>
            ) : null}

            {/* List */}
            <section className="space-y-5">
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
                      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                    >
                      {/* Header strip */}
                      <header className="flex flex-col gap-3 border-b border-gray-100 bg-gradient-to-r from-[#01411C] to-[#025d2a] px-6 py-4 text-white md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-base font-bold text-white ring-1 ring-white/30">
                            {lawyerInitials(lawyer)}
                          </div>
                          <div className="min-w-0">
                            <h2 className="truncate text-lg font-semibold">
                              {fullName}
                            </h2>
                            <p className="truncate text-xs text-green-100/90">
                              {lawyer.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white ring-1 ring-white/25">
                            <Briefcase className="h-3 w-3" />
                            Lawyer
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-950">
                            Pending Review
                          </span>
                        </div>
                      </header>

                      <div className="p-6">
                        {/* Body grid: details + status sidebar */}
                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                          {/* Left — Lawyer details */}
                          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Lawyer Details
                            </h3>
                            <dl className="mt-3 grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
                              <DetailRow
                                icon={<Mail className="h-4 w-4 text-[#01411C]" />}
                                label="Email"
                                value={lawyer.email}
                              />
                              <DetailRow
                                icon={<Phone className="h-4 w-4 text-[#01411C]" />}
                                label="Phone"
                                value={lawyer.phone ?? "—"}
                              />
                              <DetailRow
                                icon={<Hash className="h-4 w-4 text-[#01411C]" />}
                                label="CNIC"
                                value={lawyer.cnic}
                                mono
                              />
                              <DetailRow
                                icon={<Briefcase className="h-4 w-4 text-[#01411C]" />}
                                label="Specialization"
                                value={lawyer.specialization}
                              />
                              <DetailRow
                                icon={<Building2 className="h-4 w-4 text-[#01411C]" />}
                                label="District Bar"
                                value={lawyer.districtBar}
                              />
                              <DetailRow
                                icon={<CalendarClock className="h-4 w-4 text-[#01411C]" />}
                                label="Submitted"
                                value={formatSubmittedAt(lawyer.submittedAt)}
                              />
                            </dl>

                            {lawyer.cnicMatchRemarks ? (
                              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>{lawyer.cnicMatchRemarks}</span>
                              </div>
                            ) : null}
                          </div>

                          {/* Right — Verification status sidebar */}
                          <aside className="space-y-4">
                            <div className="rounded-xl border border-[#01411C]/15 bg-[#01411C]/5 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-[#01411C]">
                                Bar Council License
                              </p>
                              <p className="mt-1.5 font-mono text-lg font-bold text-[#01411C]">
                                {lawyer.barLicenseNumber}
                              </p>
                              <p className="mt-0.5 text-xs text-gray-600">
                                {lawyer.districtBar}
                              </p>
                            </div>

                            <div className="rounded-xl border border-gray-200 bg-white p-4">
                              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                <IdCard className="h-4 w-4 text-[#01411C]" />
                                Verification Checklist
                              </h3>
                              <p className="mt-1 text-xs text-gray-600">
                                Confirm both items before approving.
                              </p>
                              <div className="mt-3 flex flex-col gap-2.5">
                                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-700 transition hover:bg-gray-100">
                                  <input
                                    type="checkbox"
                                    checked={gate.licenseNumberChecked}
                                    onChange={(e) =>
                                      setGate(lawyer.lawyerProfileId, {
                                        licenseNumberChecked: e.target.checked,
                                      })
                                    }
                                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-600"
                                  />
                                  <span>License number verified manually</span>
                                </label>
                                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-700 transition hover:bg-gray-100">
                                  <input
                                    type="checkbox"
                                    checked={gate.licenseCardMatched}
                                    onChange={(e) =>
                                      setGate(lawyer.lawyerProfileId, {
                                        licenseCardMatched: e.target.checked,
                                      })
                                    }
                                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-600"
                                  />
                                  <span>Uploaded license card matches the records</span>
                                </label>
                              </div>
                            </div>
                          </aside>
                        </div>

                        {/* Documents gallery */}
                        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                              <FileText className="h-4 w-4 text-[#01411C]" />
                              Submitted Documents
                            </h3>
                            <span className="text-xs text-gray-500">
                              {lawyer.documents.length} file
                              {lawyer.documents.length === 1 ? "" : "s"}
                            </span>
                          </div>

                          {lawyer.documents.length === 0 ? (
                            <p className="mt-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-xs text-gray-500">
                              No documents recorded for this submission.
                            </p>
                          ) : (
                            <ul className="mt-3 grid gap-3 md:grid-cols-2">
                              {lawyer.documents.map((doc) => {
                                const label =
                                  documentLabels[doc.documentType] ?? doc.documentType;
                                const isImage = doc.mimeType?.startsWith("image/");
                                const isPdf = doc.mimeType === "application/pdf";

                                return (
                                  <li
                                    key={`${lawyer.lawyerProfileId}-${doc.documentType}`}
                                    className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-gray-900">
                                          {label}
                                        </p>
                                        <p
                                          className="mt-0.5 truncate text-xs text-gray-600"
                                          title={doc.fileName ?? ""}
                                        >
                                          {doc.fileName ?? "(no filename)"}
                                        </p>
                                      </div>
                                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-200">
                                        {formatBytes(doc.fileSize)}
                                      </span>
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
                                            className="max-h-56 w-full object-contain"
                                            loading="lazy"
                                          />
                                        </a>
                                      ) : isPdf ? (
                                        <a
                                          href={doc.previewUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center justify-center gap-2 self-start rounded-md border border-[#01411C] bg-white px-3 py-2 text-xs font-semibold text-[#01411C] transition hover:bg-green-50"
                                        >
                                          <FileText className="h-3.5 w-3.5" />
                                          Open PDF
                                          <ExternalLink className="h-3 w-3" />
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

                        {/* Review decision panel */}
                        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50/60 p-5">
                          <h3 className="text-sm font-semibold text-gray-900">
                            Review Decision
                          </h3>
                          <p className="mt-1 text-xs text-gray-600">
                            Add remarks (required when rejecting), then approve or reject this lawyer.
                          </p>

                          <textarea
                            value={gate.remarks}
                            onChange={(e) =>
                              setGate(lawyer.lawyerProfileId, {
                                remarks: e.target.value,
                              })
                            }
                            rows={3}
                            placeholder="Required when rejecting; optional when approving."
                            className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                          />

                          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-gray-500">
                              {approveAllowed
                                ? "Both verification items confirmed — ready to approve."
                                : "Tick both verification items to enable approval."}
                            </p>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={!rejectAllowed}
                                onClick={() => handleReject(lawyer)}
                                className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <XCircle className="h-4 w-4" />
                                Reject Lawyer
                              </button>
                              <button
                                type="button"
                                disabled={!approveAllowed}
                                onClick={() => handleApprove(lawyer)}
                                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                                  approveAllowed
                                    ? "bg-[#01411C] text-white hover:bg-[#025227]"
                                    : "cursor-not-allowed bg-gray-200 text-gray-500"
                                }`}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Approve Lawyer
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </section>

            {/* Optional SJP cross-check */}
            <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-[#01411C]">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Optional: cross-check on the SJP directory
                    </p>
                    <p className="mt-0.5 text-xs text-gray-600">
                      The Sindh Judicial Portal can be used for an additional public-records lookup if needed.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      "https://sjp.com.pk/",
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-[#01411C] bg-white px-4 py-2.5 text-sm font-semibold text-[#01411C] transition hover:bg-green-50 md:self-auto"
                >
                  Open SJP Directory
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

type DetailRowProps = {
  icon: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
};

function DetailRow({ icon, label, value, mono = false }: DetailRowProps) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </dt>
        <dd
          className={`truncate text-sm text-gray-900 ${mono ? "font-mono" : ""}`}
          title={value}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}
