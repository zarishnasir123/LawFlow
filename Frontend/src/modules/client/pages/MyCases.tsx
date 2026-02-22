import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  CalendarDays,
  Mail,
  Phone,
  Search,
} from "lucide-react";

import ClientLayout from "../components/ClientLayout";
import { useLoginStore } from "../../auth/store";
import { getClientCasesForEmail, type ClientCaseStatus } from "../data/myCases.mock";

function getStatusBadgeClass(status: ClientCaseStatus) {
  if (status === "hearing_scheduled") return "bg-purple-100 text-purple-700";
  if (status === "in_review") return "bg-blue-100 text-blue-700";
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  return "bg-green-100 text-green-700";
}

function getStatusLabel(status: ClientCaseStatus) {
  if (status === "hearing_scheduled") return "Hearing Scheduled";
  if (status === "in_review") return "In Review";
  if (status === "completed") return "Completed";
  return "Active";
}

export default function ClientMyCases() {
  const navigate = useNavigate();
  const email = useLoginStore((state) => state.email);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ClientCaseStatus>("all");

  const storedLoginEmail = (() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return "";
      const parsed = JSON.parse(raw) as { email?: string; role?: string };
      if (parsed.role !== "client") return "";
      return parsed.email || "";
    } catch {
      return "";
    }
  })();

  const activeEmail = email || storedLoginEmail || "";
  const caseItems = getClientCasesForEmail(activeEmail);

  const filteredCases = caseItems.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      q.length === 0 ||
      item.title.toLowerCase().includes(q) ||
      item.lawyer.name.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <ClientLayout
      brandSubtitle="My Cases"
      showBackButton
      onBackClick={() => navigate({ to: "/client-dashboard" })}
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-lg">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by case title, summary, or lawyer"
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-600"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", "active", "in_review", "hearing_scheduled", "completed"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === status
                      ? "bg-[#01411C] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {status === "all" ? "All" : getStatusLabel(status)}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {filteredCases.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
              No cases match your current filter.
            </div>
          )}

          {filteredCases.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex flex-col gap-4 border-b border-gray-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Case Overview
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-gray-900">{item.title}</h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(
                        item.status
                      )}`}
                    >
                      {getStatusLabel(item.status)}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                      {item.type === "civil" ? "Civil" : "Family"}
                    </span>
                  </div>
                  <p className="max-w-3xl text-sm leading-6 text-gray-600">{item.summary}</p>
                </div>

                <div className="grid w-full gap-2 rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-sm lg:w-72">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Filed On</span>
                    <span className="font-medium text-gray-800">{item.filedOn}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Next Hearing</span>
                    <span className="font-medium text-gray-800">{item.nextHearing}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50/70 to-white p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <BriefcaseBusiness className="h-4 w-4 text-[#01411C]" />
                    Assigned Lawyer
                  </div>
                  <p className="text-base font-semibold text-gray-900">{item.lawyer.name}</p>
                  <p className="mt-1 text-sm leading-6 text-gray-600">{item.lawyer.specialization}</p>
                  <div className="mt-2 space-y-2 text-sm text-gray-600">
                    <p className="inline-flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      {item.lawyer.email}
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      {item.lawyer.phone}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-sm font-medium text-emerald-900">
                <p className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-emerald-700" />
                  Next hearing: {item.nextHearing}
                </p>
              </div>
            </article>
          ))}
        </section>
      </div>
    </ClientLayout>
  );
}
