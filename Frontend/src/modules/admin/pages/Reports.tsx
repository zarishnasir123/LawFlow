import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
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

import { AdminHeader } from "../components/AdminHeader";
import LogoutConfirmationModal from "../components/modals/LogoutConfirmationModal";
import StatusToast from "../components/modals/StatusToast";
import { useAdminNotificationsStore } from "../store/notifications.store";
import { systemStatisticsByRange } from "../data/systemStatistics.mock";
import type { StatisticsMetricTone, StatisticsRange } from "../types";

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

export default function AdminStatisticPage() {
  const navigate = useNavigate();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<StatisticsRange>("month");

  const addSystemStatisticsNotification = useAdminNotificationsStore(
    (state) => state.addSystemStatisticsNotification,
  );

  const snapshot = useMemo(
    () => systemStatisticsByRange[selectedRange],
    [selectedRange],
  );

  const handleLogout = () => {
    localStorage.clear();
    setLogoutModalOpen(false);
    navigate({ to: "/login" });
  };

  const handlePublishStatisticsUpdate = () => {
    addSystemStatisticsNotification({
      title: "System statistics summary published",
      message: `Admin published ${snapshot.rangeLabel.toLowerCase()} analytics update.`,
      severity: "info",
    });
    setToastOpen(true);
  };

  const handleExportReport = () => {
    const report = {
      range: snapshot.rangeLabel,
      exportedAt: new Date().toISOString(),
      metrics: snapshot.metrics,
      summary: snapshot.summaryStats,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `admin-system-statistics-${selectedRange}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addSystemStatisticsNotification({
      title: "System report exported",
      message: `Admin exported ${snapshot.rangeLabel.toLowerCase()} system statistics report.`,
      severity: "success",
    });
    setToastOpen(true);
  };

  return (
    <>
      <LogoutConfirmationModal
        open={logoutModalOpen}
        onCancel={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
      />
      <StatusToast
        open={toastOpen}
        type="success"
        title="Statistics action completed"
        message="Notifications have been updated and report action was completed."
        onClose={() => setToastOpen(false)}
      />

      <div className="min-h-screen bg-gray-50">
        <AdminHeader
          title="System Statistics"
          subtitle="Comprehensive Analytics and Insights"
          onOpenNotifications={() => navigate({ to: "/admin-notifications" })}
          onLogout={() => setLogoutModalOpen(true)}
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
                  onClick={handlePublishStatisticsUpdate}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#01411C] px-4 py-2.5 text-sm font-semibold text-[#01411C] hover:bg-green-50"
                >
                  <BarChart3 className="h-4 w-4" />
                  Publish Update
                </button>
                <button
                  type="button"
                  onClick={handleExportReport}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#01411C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#025227]"
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
                <BarChart data={snapshot.registrarPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" angle={-35} textAnchor="end" height={76} />
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
      </div>
    </>
  );
}
