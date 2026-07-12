import type { LucideIcon } from "lucide-react";

export type DashboardStat = {
  label: string;
  value: string;
  icon: LucideIcon;
  accentClassName: string;
  onClick?: () => void;
};

export type QuickActionItem = {
  label: string;
  icon: LucideIcon;
  className: string;
  to: string;
  // Optional count bubble (e.g. unread messages). Rendered only when > 0.
  badge?: number;
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
  id: number | string;
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
  // Optional avatar override for the action button. When set, the
  // header renders a circular avatar (image if avatarUrl, else the
  // initials text) in place of the icon — Gmail-style profile chip.
  avatarUrl?: string | null;
  avatarFallback?: string;
};
