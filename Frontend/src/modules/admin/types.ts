// src/modules/admin/types.ts
import type { LucideIcon } from "lucide-react";

export type AdminStat = {
  title: string;
  value: string;
  icon: LucideIcon;
  colorClass: string; // tailwind class (e.g. bg-yellow-500)
  change: string;
};

export type RecentActivityItem = {
  id: number;
  user: string;
  action: string;
  time: string;
  status: "success" | "info";
};

export type PendingVerification = {
  id: number;
  name: string;
  type: "Lawyer" | "Client";
  email: string;
  submitted: string;
  documents: string[];
  barCouncilLicenseNumber?: string;
  licenseIssuingAuthority?: string;
};

export type CaseDomain = "civil" | "family";

export type TemplateDocument = {
  id: string;
  name: string;
  status: "active" | "archived";
  updatedAt: string;
  source: "manual" | "device_upload";
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
};

export type CaseTemplateCategory = {
  id: string;
  domain: CaseDomain;
  caseType: string;
  governingLaw: string;
  documents: TemplateDocument[];
  createdAt: string;
  updatedAt: string;
};

export type AdminNotificationCategory =
  | "lawyer_verification"
  | "system_statistics"
  | "registrar_management";

export type AdminNotificationSeverity = "info" | "success" | "warning";

export type AdminNotification = {
  id: string;
  title: string;
  message: string;
  category: AdminNotificationCategory;
  severity: AdminNotificationSeverity;
  createdAt: string;
  isRead: boolean;
};

export type StatisticsRange = "week" | "month" | "year";

export type StatisticsMetricTone = "emerald" | "blue" | "violet" | "orange";

export type StatisticsMetric = {
  id: string;
  title: string;
  value: string;
  change: string;
  tone: StatisticsMetricTone;
};

export type UserRegistrationTrendPoint = {
  label: string;
  clients: number;
  lawyers: number;
  total: number;
};

export type DistributionItem = {
  name: string;
  value: number;
  color: string;
};

export type MonthlyRevenuePoint = {
  label: string;
  revenue: number;
};

export type VerificationStatusPoint = {
  status: "Approved" | "Pending" | "Rejected";
  lawyers: number;
  clients: number;
};

export type DailyActivePoint = {
  day: string;
  users: number;
};

export type RegistrarPerformancePoint = {
  name: string;
  processed: number;
  approved: number;
  returned: number;
};

export type SummaryStatistic = {
  id: string;
  label: string;
  value: string;
  tone: StatisticsMetricTone;
};

export type AdminStatisticsSnapshot = {
  rangeLabel: string;
  metrics: StatisticsMetric[];
  userRegistrationTrend: UserRegistrationTrendPoint[];
  caseTypeDistribution: DistributionItem[];
  userTypeDistribution: DistributionItem[];
  monthlyRevenue: MonthlyRevenuePoint[];
  verificationStatus: VerificationStatusPoint[];
  caseStatusDistribution: DistributionItem[];
  dailyActiveUsers: DailyActivePoint[];
  registrarPerformance: RegistrarPerformancePoint[];
  summaryStats: SummaryStatistic[];
};
