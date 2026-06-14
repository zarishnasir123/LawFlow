import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  FilePenLine,
  FileSignature,
  FileStack,
  GitBranch,
  Pencil,
  RotateCcw,
  Send,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";

import {
  fetchAdminCaseDetail,
  type CaseEventType,
  type CaseTimelineEvent,
} from "../api/adminCases";
import { extractApiErrorMessage } from "../../../shared/api/extractApiErrorMessage";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "—";
  return `Rs ${value.toLocaleString()}`;
}

// Per-event-type presentation: a lucide icon, a label, and the dot/ring
// colour for the timeline node. Keeps the timeline scannable at a glance —
// green for forward progress (created/submitted/accepted/signed), rose for
// a return, slate for an edit.
const eventMeta: Record<
  CaseEventType,
  { icon: LucideIcon; label: string; dot: string; ring: string }
> = {
  created: {
    icon: Sparkles,
    label: "Case created",
    dot: "bg-[#01411C] text-white",
    ring: "ring-green-100",
  },
  submitted: {
    icon: Send,
    label: "Submitted to registrar",
    dot: "bg-[#01411C] text-white",
    ring: "ring-green-100",
  },
  resubmitted: {
    icon: Send,
    label: "Resubmitted to registrar",
    dot: "bg-[#01411C] text-white",
    ring: "ring-green-100",
  },
  returned: {
    icon: RotateCcw,
    label: "Returned by registrar",
    dot: "bg-rose-600 text-white",
    ring: "ring-rose-100",
  },
  accepted: {
    icon: CheckCircle2,
    label: "Accepted by registrar",
    dot: "bg-green-600 text-white",
    ring: "ring-green-100",
  },
  client_signed: {
    icon: FileSignature,
    label: "Client signed",
    dot: "bg-emerald-600 text-white",
    ring: "ring-emerald-100",
  },
  lawyer_signed: {
    icon: FileSignature,
    label: "Lawyer signed",
    dot: "bg-emerald-600 text-white",
    ring: "ring-emerald-100",
  },
  signed_pdf_compiled: {
    icon: FileStack,
    label: "Signed PDF compiled",
    dot: "bg-indigo-600 text-white",
    ring: "ring-indigo-100",
  },
  edited: {
    icon: Pencil,
    label: "Case edited",
    dot: "bg-slate-500 text-white",
    ring: "ring-slate-100",
  },
  deleted: {
    icon: AlertTriangle,
    label: "Case deleted",
    dot: "bg-gray-600 text-white",
    ring: "ring-gray-100",
  },
};

const statusBadgeClasses: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-amber-100 text-amber-700",
  returned: "bg-rose-100 text-rose-700",
  accepted: "bg-green-100 text-green-700",
};

export default function CaseDetail() {
  // The pathless layout route prefixes typed `from` strings with /_admin
  // (TanStack convention). Don't drop the prefix or useParams won't resolve.
  const { caseId } = useParams({ from: "/_admin/cases/$caseId" });

  const detailQuery = useQuery({
    queryKey: ["admin", "case", caseId],
    queryFn: () => fetchAdminCaseDetail(caseId),
  });

  const detail = detailQuery.data;

  return (
    <div className="w-full px-6 lg:px-8 xl:px-10 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Link
          to="/cases"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#01411C] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Case Tracking
        </Link>

        {detailQuery.isLoading ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-600">
            Loading case…
          </div>
        ) : detailQuery.isError ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {extractApiErrorMessage(
                detailQuery.error,
                "Could not load this case.",
              )}
            </span>
          </div>
        ) : !detail ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-600">
            Case not found.
          </div>
        ) : (
          <>
            {/* (1) Case facts card */}
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <header className="flex flex-col gap-3 border-b border-gray-100 bg-gradient-to-r from-[#01411C] to-[#025d2a] px-6 py-5 text-white md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30">
                    <GitBranch className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl font-semibold">{detail.case.title}</h1>
                    <p className="text-xs text-green-100/90">
                      {detail.case.caseType}
                      {detail.case.category ? ` · ${detail.case.category}` : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center self-start rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                    statusBadgeClasses[detail.case.status] ??
                    "bg-white/15 text-white"
                  }`}
                >
                  {detail.case.status}
                </span>
              </header>

              <dl className="grid gap-x-6 gap-y-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                <Fact
                  icon={Briefcase}
                  label="Lawyer"
                  value={detail.case.lawyerName}
                />
                <Fact
                  icon={User}
                  label="Client"
                  value={detail.case.clientName}
                />
                <Fact
                  icon={GitBranch}
                  label="Assigned Tehsil"
                  value={detail.case.assignedTehsil ?? "—"}
                />
                <Fact
                  icon={CalendarClock}
                  label="Created"
                  value={formatDateTime(detail.case.createdAt)}
                />
                <Fact
                  icon={Send}
                  label="Submitted"
                  value={formatDateTime(detail.case.submittedAt)}
                />
                <Fact
                  icon={CheckCircle2}
                  label="Reviewed"
                  value={formatDateTime(detail.case.reviewedAt)}
                />
                <Fact
                  icon={User}
                  label="Registrar"
                  value={detail.case.registrarName ?? "Not yet reviewed"}
                />
              </dl>
            </section>

            {/* (2) Vertical timeline — oldest first */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <FilePenLine className="h-4 w-4 text-[#01411C]" />
                Case Timeline
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Oldest first. Rows marked “approximate / historical” were
                reconstructed from case records before audit logging began.
              </p>

              {detail.timeline.length === 0 ? (
                <p className="mt-5 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                  No tracked events for this case yet.
                </p>
              ) : (
                <ol className="mt-6 space-y-0">
                  {detail.timeline.map((event, index) => (
                    <TimelineNode
                      key={event.id}
                      event={event}
                      isLast={index === detail.timeline.length - 1}
                    />
                  ))}
                </ol>
              )}
            </section>

            {/* (3) Payment readiness panel */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <Banknote className="h-4 w-4 text-[#01411C]" />
                Payment Readiness
              </h2>

              {detail.paymentReadiness.hasAgreement ? (
                <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Money label="Agreed Fee" value={detail.paymentReadiness.agreedFee} />
                  <Money
                    label="Lawyer Base Fee"
                    value={detail.paymentReadiness.lawyerBaseFee}
                  />
                  <Money label="Paid Amount" value={detail.paymentReadiness.paidAmount} />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Agreement Status
                    </dt>
                    <dd className="mt-1 text-sm font-medium capitalize text-gray-900">
                      {detail.paymentReadiness.agreementStatus ?? "—"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                  No fee agreement exists for this case yet, so no payout can be
                  prepared.
                </p>
              )}

              {/* Read-only payout-eligibility indicator. This is the FUTURE
                  payout trigger surfaced for visibility only — there is
                  deliberately NO action button here. Eligibility flips true
                  once a registrar accepts the case. */}
              <div
                className={`mt-6 flex items-start gap-3 rounded-xl border p-4 ${
                  detail.paymentReadiness.payoutEligible
                    ? "border-green-200 bg-green-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    detail.paymentReadiness.payoutEligible
                      ? "bg-green-600 text-white"
                      : "bg-gray-300 text-white"
                  }`}
                >
                  <Banknote className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Payout eligibility:{" "}
                    {detail.paymentReadiness.payoutEligible
                      ? "Eligible"
                      : "Not yet eligible"}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-600">
                    {detail.paymentReadiness.payoutEligible
                      ? "This case has been accepted and meets the conditions for a future payout. The payout trigger is not yet wired — this indicator is for visibility only."
                      : "A payout becomes eligible once the case is accepted by a registrar. This is a read-only indicator; no payout action is available here."}
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#01411C]" />
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </dt>
        <dd className="truncate text-sm text-gray-900" title={value}>
          {value}
        </dd>
      </div>
    </div>
  );
}

function Money({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-gray-900">
        {formatMoney(value)}
      </dd>
    </div>
  );
}

function TimelineNode({
  event,
  isLast,
}: {
  event: CaseTimelineEvent;
  isLast: boolean;
}) {
  const meta = eventMeta[event.eventType] ?? {
    icon: FilePenLine,
    label: event.eventType,
    dot: "bg-gray-500 text-white",
    ring: "ring-gray-100",
  };
  const Icon = meta.icon;
  const isBackfill = event.payload?.backfill === true;

  // Per-event-type payload specifics surfaced under the headline.
  const reviewRemarks =
    event.eventType === "returned"
      ? (event.payload?.reviewRemarks as string | undefined)
      : undefined;
  const signerRole =
    event.eventType === "client_signed" || event.eventType === "lawyer_signed"
      ? (event.payload?.signerRole as string | undefined)
      : undefined;
  const changedFields =
    event.eventType === "edited" &&
    Array.isArray(event.payload?.changedFields)
      ? (event.payload.changedFields as string[])
      : undefined;

  const actorLine = [event.actorName, event.actorRole]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {/* Connector rail between nodes. Hidden on the final node. */}
      {!isLast ? (
        <span
          className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-gray-200"
          aria-hidden
        />
      ) : null}

      <div
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ${meta.dot} ${meta.ring}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">
            {meta.label}
          </span>
          {isBackfill ? (
            <span
              className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700"
              title="Reconstructed from case records before audit logging existed"
            >
              Approximate / historical
            </span>
          ) : null}
        </div>

        <p className="mt-0.5 text-xs text-gray-500">
          {actorLine ? <span>{actorLine} · </span> : null}
          {formatDateTime(event.createdAt)}
        </p>

        {signerRole ? (
          <p className="mt-1 text-xs text-gray-600">
            Signed by{" "}
            <span className="font-medium capitalize">{signerRole}</span>
          </p>
        ) : null}

        {changedFields && changedFields.length > 0 ? (
          <p className="mt-1 text-xs text-gray-600">
            Changed: {changedFields.join(", ")}
          </p>
        ) : null}

        {reviewRemarks ? (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            <span className="font-semibold">Registrar remarks: </span>
            {reviewRemarks}
          </div>
        ) : null}
      </div>
    </li>
  );
}
