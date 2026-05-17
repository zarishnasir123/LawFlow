import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  CalendarClock,
  Hash,
  IdCard,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  UserX,
} from "lucide-react";

import { fetchLawyerRejectionHistory, type LawyerRejectionRecord } from "../api/lawyerRejections";
import { getAuthErrorMessage } from "../../auth/api";

function formatRejectedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function displayName(record: LawyerRejectionRecord) {
  return (
    [record.firstName, record.lastName].filter(Boolean).join(" ") || record.email
  );
}

export default function RejectionHistory() {
  const [search, setSearch] = useState("");

  const historyQuery = useQuery({
    queryKey: ["admin", "lawyer-rejections", search],
    queryFn: () => fetchLawyerRejectionHistory({ limit: 50, search: search.trim() || undefined }),
  });

  const records = historyQuery.data?.items ?? [];
  const total = historyQuery.data?.pagination.total ?? 0;

  return (
    <div className="w-full px-6 lg:px-8 xl:px-10 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
            <section className="rounded-2xl border border-rose-100 bg-gradient-to-br from-white via-white to-rose-50/40 p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-700 text-white">
                    <UserX className="h-5 w-5" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-[#01411C]">
                      Returned lawyer registrations
                    </h1>
                    <p className="mt-1 max-w-3xl text-sm text-gray-600">
                      Audit log of lawyer applications returned by admin. These accounts were
                      removed so the lawyer can register again with the same email.
                    </p>
                    <Link
                      to="/verifications"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#01411C] hover:underline"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to pending verifications
                    </Link>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start rounded-full bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-800">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {historyQuery.isLoading
                    ? "Loading…"
                    : `${total} returned ${total === 1 ? "record" : "records"}`}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <label htmlFor="rejectionSearch" className="sr-only">
                Search returned registrations
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="rejectionSearch"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, CNIC, or license number"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                />
              </div>
            </section>

            <section className="space-y-4">
              {historyQuery.isLoading ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-600">
                  Loading rejection history…
                </div>
              ) : historyQuery.isError ? (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{getAuthErrorMessage(historyQuery.error)}</span>
                </div>
              ) : records.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-600">
                  No returned lawyer registrations found.
                </div>
              ) : (
                records.map((record) => (
                  <article
                    key={record.id}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                  >
                    <header className="flex flex-col gap-2 border-b border-gray-100 bg-gradient-to-r from-rose-800 to-rose-700 px-6 py-4 text-white md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-lg font-semibold">{displayName(record)}</p>
                        <p className="text-sm text-rose-100">{record.email}</p>
                      </div>
                      <p className="text-xs font-medium text-rose-100">
                        Returned {formatRejectedAt(record.rejectedAt)}
                      </p>
                    </header>

                    <div className="grid gap-4 p-6 md:grid-cols-2">
                      <dl className="space-y-3">
                        <Detail icon={<Mail className="h-4 w-4" />} label="Email" value={record.email} />
                        <Detail
                          icon={<Phone className="h-4 w-4" />}
                          label="Phone"
                          value={record.phone ?? "—"}
                        />
                        <Detail
                          icon={<IdCard className="h-4 w-4" />}
                          label="CNIC"
                          value={record.cnic ?? "—"}
                          mono
                        />
                        <Detail
                          icon={<Hash className="h-4 w-4" />}
                          label="Bar license"
                          value={record.barLicenseNumber ?? "—"}
                          mono
                        />
                      </dl>
                      <dl className="space-y-3">
                        <Detail
                          icon={<Briefcase className="h-4 w-4" />}
                          label="Specialization"
                          value={record.specialization ?? "—"}
                        />
                        <Detail
                          icon={<ShieldCheck className="h-4 w-4" />}
                          label="District bar"
                          value={record.districtBar ?? "—"}
                        />
                        <Detail
                          icon={<Mail className="h-4 w-4" />}
                          label="Returned by"
                          value={record.rejectedByEmail ?? "—"}
                        />
                      </dl>
                    </div>

                    <div className="border-t border-gray-100 bg-amber-50/60 px-6 py-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                        Admin remarks
                      </p>
                      <p className="mt-1 text-sm text-amber-950">
                        {record.rejectionRemarks?.trim() || "No remarks recorded."}
                      </p>
                    </div>
                  </article>
                ))
              )}
            </section>
      </div>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 shrink-0 text-gray-500">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </dt>
        <dd className={`truncate text-gray-900 ${mono ? "font-mono" : ""}`} title={value}>
          {value}
        </dd>
      </div>
    </div>
  );
}
