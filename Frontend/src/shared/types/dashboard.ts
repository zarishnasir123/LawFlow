import type { LucideIcon } from "lucide-react";

export type DashboardStat = {
  label: string;
  value: string;
  icon: LucideIcon;
  accentClassName: string;
};

export type QuickActionItem = {
  label: string;
  icon: LucideIcon;
  className: string;
  to: string;
};

export type CaseItem = {
  id: number;
  caseNumber: string;
  title: string;
  lawyer: string;
  status: string;
  lastUpdate: string;
  nextHearing: string;
};

export type HearingItem = {
  id: number;
  caseNumber: string;
  title: string;
  dateTime: string;
};

export type ActivityItem = {
  id: number;
  label: string;
  time: string;
  type: "message" | "case";
};

export type HeaderAction = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  badge?: number;
};
