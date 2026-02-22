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
