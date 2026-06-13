import { useEffect, useMemo, useState } from "react";
import {
  Search,
  CheckCircle,
  Clock,
  FileText,
  Mail,
  Phone,
  Users,
  AlertCircle,
  UploadCloud,
  Loader2,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import LawyerLayout from "../components/LawyerLayout";
import DeleteCaseModal from "../components/modals/DeleteCaseModal";
import {
  casesApi,
  getCasesErrorMessage,
  type ApiCase,
  type CaseStatus,
} from "../api/cases.api";

// Live lawyer "My Cases" page. Replaces the previous mock-only stub.
// Reads from GET /api/cases (lawyer-scoped on the backend via auth)
// so every case the lawyer created here is visible and reopenable.
//
// Per AGENTS.md, the backend cases table only ships these statuses:
//   draft | submitted | returned | accepted
// (The richer "active / pending / on-hold / closed" set the old mock
// page used will return when the case-lifecycle tables ship; for
// now the four real statuses cover the user's "go back to my case"
// requirement.)

type StatusFilter = "all" | CaseStatus;

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "returned", label: "Returned" },
  { value: "accepted", label: "Accepted" },
];

function getStatusBadge(status: CaseStatus) {
  switch (status) {
    case "draft":
      return {
        label: "Draft",
        icon: <Pencil className="w-3.5 h-3.5" />,
        className: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
      };
    case "submitted":
      return {
        label: "Submitted",
        icon: <Clock className="w-3.5 h-3.5" />,
        className: "bg-blue-100 text-blue-800 ring-1 ring-blue-200",
      };
    case "returned":
      return {
        label: "Returned",
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        className: "bg-red-100 text-red-800 ring-1 ring-red-200",
      };
    case "accepted":
      return {
        label: "Accepted",
        icon: <CheckCircle className="w-3.5 h-3.5" />,
        className: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
      };
  }
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function LawyerCases() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");

  // The case currently targeted by the delete-confirmation modal. null means
  // the modal is closed. Holding the whole case (not just its id) lets the
  // modal show the title in its warning copy.
  const [caseToDelete, setCaseToDelete] = useState<ApiCase | null>(null);
  // Inline success toast after a delete, mirroring the toast pattern used in
  // the document editor (no global toaster exists in this app).
  const [toast, setToast] = useState<string | null>(null);

  // Server state lives in TanStack Query (per Frontend-AGENTS.md) so the submit
  // mutation on the submission page can invalidate ["lawyer", "cases"] and this
  // list refreshes — a resubmitted case flips returned -> submitted here without
  // a manual reload.
  const {
    data: cases = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["lawyer", "cases"],
    queryFn: casesApi.listMyCases,
  });
  const error = queryError ? getCasesErrorMessage(queryError) : null;

  // Hard-delete mutation. On success we invalidate the list (so the deleted
  // card disappears), close the modal, and raise a success toast. On error we
  // keep the modal open and surface the backend message (incl. the 409 for
  // cases with linked records) via deleteMutation.error below.
  const deleteMutation = useMutation({
    mutationFn: (caseId: string) => casesApi.deleteCase(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lawyer", "cases"] });
      setCaseToDelete(null);
      setToast("Case deleted permanently.");
    },
  });

  // Auto-dismiss the success toast after 4s so it doesn't loiter.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Clear any stale mutation error whenever the modal target changes, so a
  // previous failure doesn't flash when the lawyer opens the modal for a
  // different case.
  const openDeleteModal = (target: ApiCase) => {
    deleteMutation.reset();
    setCaseToDelete(target);
  };
  const closeDeleteModal = () => {
    if (deleteMutation.isPending) return;
    deleteMutation.reset();
    setCaseToDelete(null);
  };

  const filteredCases = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return cases.filter((c) => {
      const matchesStatus = filterStatus === "all" || c.status === filterStatus;
      const matchesSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q) ||
        (c.oppositePartyName ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [cases, searchTerm, filterStatus]);

  // Per-status counts — drives both the stats grid and lets the
  // tabs show a "(n)" hint without iterating cases per tab render.
  const counts = useMemo(() => {
    const acc: Record<CaseStatus | "all", number> = {
      all: cases.length,
      draft: 0,
      submitted: 0,
      returned: 0,
      accepted: 0,
    };
    for (const c of cases) acc[c.status] += 1;
    return acc;
  }, [cases]);

  return (
    <LawyerLayout brandTitle="LawFlow" brandSubtitle="My Cases">
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              My <span className="text-[var(--primary)]">Cases</span>
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Every case you've created. Click <span className="font-medium text-gray-800">Open Editor</span> to resume
              work on the document.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: "/lawyer-new-case" })}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#024a23]"
          >
            <Plus className="h-4 w-4" />
            New Case
          </button>
        </header>

        {/* Stat cards — quick at-a-glance status breakdown. */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Drafts"
            value={counts.draft}
            tone="amber"
            icon={<Pencil className="w-5 h-5" />}
          />
          <StatCard
            label="Submitted"
            value={counts.submitted}
            tone="blue"
            icon={<Clock className="w-5 h-5" />}
          />
          <StatCard
            label="Returned"
            value={counts.returned}
            tone="red"
            icon={<AlertCircle className="w-5 h-5" />}
          />
          <StatCard
            label="Accepted"
            value={counts.accepted}
            tone="emerald"
            icon={<CheckCircle className="w-5 h-5" />}
          />
        </div>

        {/* Search + tabs */}
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by case title, client, or opposite party…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50/60 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => {
              const active = filterStatus === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setFilterStatus(tab.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    active
                      ? "bg-[var(--primary)] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      active ? "bg-white/20" : "bg-white text-gray-600"
                    }`}
                  >
                    {counts[tab.value]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* States: loading / error / empty / list */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white p-10 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your cases…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
            {error}
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-600">
              {cases.length === 0
                ? "You haven't created any cases yet."
                : "No cases match your search."}
            </p>
            {cases.length === 0 && (
              <button
                type="button"
                onClick={() => navigate({ to: "/lawyer-new-case" })}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23]"
              >
                <Plus className="h-4 w-4" />
                Create your first case
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredCases.map((c) => {
              const badge = getStatusBadge(c.status);
              return (
                <li
                  key={c.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 transition hover:border-emerald-200 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    {/* Identity + meta */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}
                        >
                          {badge.icon}
                          {badge.label}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                            c.caseCategory === "civil"
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                              : "bg-purple-50 text-purple-700 ring-purple-100"
                          }`}
                        >
                          {c.caseCategory === "civil" ? "Civil" : "Family"}
                        </span>
                        <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200">
                          {c.caseTypeName}
                        </span>
                      </div>
                      <h3 className="mt-2 truncate text-base font-semibold text-gray-900">
                        {c.title}
                      </h3>
                      {c.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                          {c.description}
                        </p>
                      ) : null}

                      {/* Registrar return reason — the lawyer must read this and
                          fix the case before resubmitting via the Submit button. */}
                      {c.status === "returned" && (
                        <div className="mt-3 rounded-lg border-l-4 border-red-500 bg-red-50 px-3 py-2">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                            <div>
                              <p className="text-xs font-semibold text-red-900">
                                Returned by registrar — reason for return
                              </p>
                              <p className="mt-0.5 text-sm text-red-800">
                                {c.reviewRemarks?.trim() ||
                                  "No written reason was provided. Contact the registrar for details."}
                              </p>
                              {c.reviewedAt ? (
                                <p className="mt-1 text-[11px] text-red-700">
                                  Returned {formatDate(c.reviewedAt)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-3">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-gray-400" />
                          <span className="font-medium text-gray-700">{c.clientName}</span>
                          {c.clientEmail ? (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-gray-400">
                              <Mail className="h-3 w-3" />
                              {c.clientEmail}
                            </span>
                          ) : null}
                        </span>
                        {c.clientPhone ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-gray-400" />
                            {c.clientPhone}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-gray-500">vs.</span>
                          <span className="font-medium text-gray-700">
                            {c.oppositePartyName}
                          </span>
                        </span>
                      </div>

                      <div className="mt-2 text-[11px] text-gray-500">
                        Created {formatDate(c.createdAt)} · Last edited{" "}
                        {formatDate(c.updatedAt)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-shrink-0 flex-col gap-2 md:w-48">
                      <button
                        type="button"
                        onClick={() =>
                          navigate({ to: `/lawyer-case-editor/${c.id}` })
                        }
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23]"
                      >
                        <FileText className="h-4 w-4" />
                        Open Editor
                      </button>

                      {/* Submit affordance gated by status:
                          - draft    -> active "Submit"
                          - returned -> active "Fix & Resubmit"
                          - submitted/accepted -> muted, non-interactive
                            status indicator (no active submit). */}
                      <SubmitAffordance
                        status={c.status}
                        onSubmit={() =>
                          navigate({ to: `/lawyer-submit-case/${c.id}` })
                        }
                      />

                      <button
                        type="button"
                        onClick={() => openDeleteModal(c)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:border-red-300 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Hard-delete confirmation. Typed-DELETE gate lives in the modal; the
          page owns the mutation, the open/closed state, and the error surface
          (deleteMutation.error covers the backend 409 for linked records).
          Mounted only while a case is targeted so the confirm input resets
          on every open. */}
      {caseToDelete && (
        <DeleteCaseModal
          caseTitle={caseToDelete.title}
          isLoading={deleteMutation.isPending}
          errorMessage={
            deleteMutation.error
              ? getCasesErrorMessage(deleteMutation.error)
              : null
          }
          onClose={closeDeleteModal}
          onConfirm={() => deleteMutation.mutate(caseToDelete.id)}
        />
      )}

      {/* Inline success toast (no global toaster in this app). */}
      {toast && (
        <button
          type="button"
          onClick={() => setToast(null)}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          {toast}
        </button>
      )}
    </LawyerLayout>
  );
}

// Submit affordance gated by case status. Draft and returned cases get an
// active button that routes to the submission page; submitted and accepted
// cases get a muted, non-interactive chip — there is no active submit for a
// case that's already with (or cleared by) the registrar.
function SubmitAffordance({
  status,
  onSubmit,
}: {
  status: CaseStatus;
  onSubmit: () => void;
}) {
  if (status === "draft" || status === "returned") {
    return (
      <button
        type="button"
        onClick={onSubmit}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
      >
        <UploadCloud className="h-4 w-4" />
        {status === "returned" ? "Fix & Resubmit" : "Submit"}
      </button>
    );
  }

  // submitted | accepted -> muted indicator, no active submit.
  const isAccepted = status === "accepted";
  return (
    <span
      aria-disabled="true"
      className="inline-flex w-full cursor-default items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400"
    >
      {isAccepted ? (
        <CheckCircle className="h-4 w-4" />
      ) : (
        <Clock className="h-4 w-4" />
      )}
      {isAccepted ? "Accepted" : "Submitted"}
    </span>
  );
}

// Small stat card — same shape across the four boxes. Tone drives
// the icon + value color so each status has its own visual weight.
function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "amber" | "blue" | "red" | "emerald";
  icon: React.ReactNode;
}) {
  const toneMap = {
    amber: { value: "text-amber-700", icon: "text-amber-500", ring: "border-amber-100" },
    blue: { value: "text-blue-700", icon: "text-blue-500", ring: "border-blue-100" },
    red: { value: "text-red-700", icon: "text-red-500", ring: "border-red-100" },
    emerald: { value: "text-emerald-700", icon: "text-emerald-500", ring: "border-emerald-100" },
  }[tone];

  return (
    <div className={`rounded-xl border ${toneMap.ring} bg-white p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            {label}
          </p>
          <p className={`mt-1 text-2xl font-bold ${toneMap.value}`}>{value}</p>
        </div>
        <div className={`flex-shrink-0 ${toneMap.icon}`}>{icon}</div>
      </div>
    </div>
  );
}
