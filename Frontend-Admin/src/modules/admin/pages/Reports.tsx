import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  Activity,
  Download,
  FileText,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import StatusToast from "../components/modals/StatusToast";
import { getStatistics } from "../api/statistics";
import type {
  AdminStatisticsSnapshot,
  StatisticsMetricTone,
  StatisticsRange,
} from "../types";

const metricToneStyles: Record<
  StatisticsMetricTone,
  { wrapper: string; icon: string; chip: string }
> = {
  emerald: {
    wrapper: "border-emerald-100 bg-emerald-50",
    icon: "text-emerald-700 bg-emerald-100",
    chip: "bg-emerald-100 text-emerald-700",
  },
  blue: {
    wrapper: "border-blue-100 bg-blue-50",
    icon: "text-blue-700 bg-blue-100",
    chip: "bg-blue-100 text-blue-700",
  },
  violet: {
    wrapper: "border-violet-100 bg-violet-50",
    icon: "text-violet-700 bg-violet-100",
    chip: "bg-violet-100 text-violet-700",
  },
  orange: {
    wrapper: "border-amber-100 bg-amber-50",
    icon: "text-amber-700 bg-amber-100",
    chip: "bg-amber-100 text-amber-700",
  },
};

const metricIcons = [Users, FileText, TrendingUp, Activity];

const summaryToneStyles: Record<StatisticsMetricTone, string> = {
  emerald: "bg-emerald-50 text-emerald-700",
  blue: "bg-blue-50 text-blue-700",
  violet: "bg-violet-50 text-violet-700",
  orange: "bg-amber-50 text-amber-700",
};

const rangeOptions: Array<{ value: StatisticsRange; label: string }> = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

const formatCurrency = (value: number) => `Rs${(value / 1000).toFixed(0)}k`;

// Rendered while the real snapshot loads: dash placeholders on the cards (same
// "—" convention as the admin Dashboard) and empty charts.
const EMPTY_SNAPSHOT: AdminStatisticsSnapshot = {
  rangeLabel: "—",
  metrics: [
    { id: "users", title: "Total Users", value: "—", change: "—", tone: "blue" },
    { id: "cases", title: "Total Cases", value: "—", change: "—", tone: "violet" },
    { id: "revenue", title: "Revenue", value: "—", change: "—", tone: "emerald" },
    { id: "active", title: "Active Today", value: "—", change: "—", tone: "orange" },
  ],
  userRegistrationTrend: [],
  caseTypeDistribution: [],
  userTypeDistribution: [],
  monthlyRevenue: [],
  verificationStatus: [],
  caseStatusDistribution: [],
  dailyActiveUsers: [],
  registrarPerformance: [],
  summaryStats: [],
};

// --- Excel (.xlsx) export -----------------------------------------------------
// Builds a real multi-sheet workbook from the snapshot. aoa_to_sheet lets each
// sheet hold heterogeneous sections (title rows + tables).
type XlsxRow = Array<string | number>;
function buildStatisticsWorkbook(snap: AdminStatisticsSnapshot): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const addSheet = (name: string, rows: XlsxRow[]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);

  addSheet("Overview", [
    ["LawFlow — System Statistics"],
    ["Range", snap.rangeLabel],
    ["Exported", new Date().toISOString()],
    [],
    ["Key Metrics"],
    ["Metric", "Value", "Change"],
    ...snap.metrics.map((m): XlsxRow => [m.title, m.value, m.change]),
    [],
    ["Summary"],
    ["Statistic", "Value"],
    ...snap.summaryStats.map((s): XlsxRow => [s.label, s.value]),
  ]);

  addSheet("Registrations", [
    ["Period", "Clients", "Lawyers", "Total"],
    ...snap.userRegistrationTrend.map((p): XlsxRow => [p.label, p.clients, p.lawyers, p.total]),
  ]);

  addSheet("Revenue", [
    ["Period", "Revenue (Rs)"],
    ...snap.monthlyRevenue.map((p): XlsxRow => [p.label, p.revenue]),
  ]);

  addSheet("Distributions", [
    ["User Type", "Count"],
    ...snap.userTypeDistribution.map((d): XlsxRow => [d.name, d.value]),
    [],
    ["Case Type", "Count"],
    ...snap.caseTypeDistribution.map((d): XlsxRow => [d.name, d.value]),
    [],
    ["Case Status", "Count"],
    ...snap.caseStatusDistribution.map((d): XlsxRow => [d.name, d.value]),
    [],
    ["Lawyer Verification", "Lawyers"],
    ...snap.verificationStatus.map((v): XlsxRow => [v.status, v.lawyers]),
  ]);

  addSheet("Active Users", [
    ["Day", "Active Users"],
    ...snap.dailyActiveUsers.map((d): XlsxRow => [d.day, d.users]),
  ]);

  addSheet("Registrars", [
    ["Registrar", "Tehsil", "Processed", "Approved", "Returned"],
    ...snap.registrarPerformance.map((r): XlsxRow => [r.name, r.tehsil, r.processed, r.approved, r.returned]),
  ]);

  return wb;
}

// Two-line X-axis tick for Registrar Performance: registrar name on top, their
// assigned tehsil beneath (muted). Avoids the truncation that long angled
// "Name — Tehsil" single-line labels caused.
type AxisTickProps = {
  x?: number;
  y?: number;
  payload?: { value?: string };
};
function RegistrarTick({ x = 0, y = 0, payload }: AxisTickProps) {
  const [name, tehsil] = String(payload?.value ?? "").split("\n");
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} dy={14} textAnchor="middle" fontSize={11} fontWeight={600} fill="#374151">
        {name}
      </text>
      {tehsil ? (
        <text x={0} dy={29} textAnchor="middle" fontSize={10} fill="#6b7280">
          {tehsil}
        </text>
      ) : null}
    </g>
  );
}

export default function AdminStatisticPage() {
  const [toastOpen, setToastOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<StatisticsRange>("month");

  const { data } = useQuery({
    queryKey: ["admin", "statistics", selectedRange],
    queryFn: () => getStatistics(selectedRange),
    staleTime: 1000 * 30,
  });
  const snapshot = data ?? EMPTY_SNAPSHOT;

  // Registrars are assigned per tehsil (court jurisdiction) — surface it on the
  // performance chart's axis so each bar group reads as "who, for which tehsil".
  const registrarChartData = snapshot.registrarPerformance.map((r) => ({
    ...r,
    // "\n" splits the registrar name (line 1) from the tehsil (line 2) in the
    // custom two-line axis tick below.
    label: r.tehsil ? `${r.name}\n${r.tehsil}` : r.name,
  }));

  const handleExportReport = () => {
    if (!data) return;
    const wb = buildStatisticsWorkbook(data);
    XLSX.writeFile(wb, `lawflow-statistics-${selectedRange}.xlsx`);
    setToastOpen(true);
  };

  return (
    <>
      <StatusToast
        open={toastOpen}
        type="success"
        title="Report exported"
        message="The statistics report has been downloaded as an Excel file (.xlsx)."
        onClose={() => setToastOpen(false)}
      />

      <div className="w-full px-6 lg:px-8 xl:px-10 py-8 space-y-6">
          <section className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-[#01411C]">Analytics Overview</h1>
                <p className="mt-1 text-sm text-gray-600">
                  View detailed system statistics and trends.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleExportReport}
                  disabled={!data}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#025227] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Export Report
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <span className="text-sm font-semibold text-gray-700">
                Range: {snapshot.rangeLabel}
              </span>
              <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
                {rangeOptions.map((rangeOption) => (
                  <button
                    key={rangeOption.value}
                    type="button"
                    onClick={() => setSelectedRange(rangeOption.value)}
                    className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                      selectedRange === rangeOption.value
                        ? "bg-[#01411C] text-white"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {rangeOption.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {snapshot.metrics.map((metric, index) => {
              const tone = metricToneStyles[metric.tone];
              const MetricIcon = metricIcons[index % metricIcons.length];
              return (
                <article
                  key={metric.id}
                  className={`rounded-xl border p-6 shadow-sm ${tone.wrapper}`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className={`inline-flex rounded-lg p-2 ${tone.icon}`}>
                      <MetricIcon className="h-5 w-5" />
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone.chip}`}
                    >
                      {metric.change}
                    </span>
                  </div>
                  <p className="text-4xl font-bold text-gray-900">{metric.value}</p>
                  <p className="mt-2 text-sm font-medium text-gray-700">{metric.title}</p>
                </article>
              );
            })}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-[#01411C]">User Registration Trends</h2>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                {snapshot.rangeLabel}
              </span>
            </div>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshot.userRegistrationTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbe4de" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="clients"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Clients"
                  />
                  <Line
                    type="monotone"
                    dataKey="lawyers"
                    stroke="#065f46"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Lawyers"
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Total"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-[#01411C]">Case Type Distribution</h3>
              <div className="mt-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={snapshot.caseTypeDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      dataKey="value"
                      nameKey="name"
                      label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {snapshot.caseTypeDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-2">
                {snapshot.caseTypeDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.name}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-[#01411C]">User Type Distribution</h3>
              <div className="mt-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={snapshot.userTypeDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={88} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {snapshot.userTypeDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-2">
                {snapshot.userTypeDistribution.map((item) => {
                  const totalUsers = snapshot.userTypeDistribution.reduce(
                    (sum, current) => sum + current.value,
                    0,
                  );
                  const percentage = totalUsers === 0 ? 0 : (item.value / totalUsers) * 100;
                  return (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="font-semibold text-gray-900">
                        {item.value} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </article>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-700" />
              <h3 className="text-xl font-semibold text-[#01411C]">Monthly Revenue</h3>
              <span className="ml-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Pakistani Rupee (Rs)
              </span>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={snapshot.monthlyRevenue}>
                  <defs>
                    <linearGradient id="revenueColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#065f46" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#065f46" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbe4de" />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip
                    formatter={(value) => {
                      const numericValue =
                        typeof value === "number" ? value : Number(value ?? 0);
                      return `Rs ${numericValue.toLocaleString()}`;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#065f46"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#revenueColor)"
                    name="Revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-[#01411C]">Verification Status</h3>
              <div className="mt-4 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={snapshot.verificationStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="status" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="lawyers" fill="#065f46" radius={[6, 6, 0, 0]} name="Lawyers" />
                    <Bar dataKey="clients" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Clients" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-[#01411C]">Case Status Distribution</h3>
              <div className="mt-4 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={snapshot.caseStatusDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={105}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        `${name}: ${(((percent ?? 0) * 100).toFixed(0))}%`
                      }
                    >
                      {snapshot.caseStatusDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-700" />
              <h3 className="text-xl font-semibold text-[#01411C]">Daily Active Users</h3>
              <span className="ml-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                Last 7 Days
              </span>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={snapshot.dailyActiveUsers}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="users" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <UserRound className="h-5 w-5 text-violet-700" />
              <h3 className="text-xl font-semibold text-[#01411C]">Registrar Performance</h3>
              <span className="ml-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                Top 5 Registrars
              </span>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={registrarChartData} margin={{ bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={<RegistrarTick />} interval={0} height={52} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="processed" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="approved" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="returned" fill="#ef4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-2xl font-semibold text-[#01411C]">Summary Statistics</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {snapshot.summaryStats.map((summary) => (
                <article
                  key={summary.id}
                  className={`rounded-xl p-5 ${summaryToneStyles[summary.tone]}`}
                >
                  <p className="text-sm font-medium opacity-85">{summary.label}</p>
                  <p className="mt-2 text-4xl font-bold">{summary.value}</p>
                </article>
              ))}
            </div>
          </section>
      </div>
    </>
  );
}
