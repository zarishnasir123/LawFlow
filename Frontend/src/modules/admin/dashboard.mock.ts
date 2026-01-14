// src/modules/admin/mock/dashboard.mock.ts
import { Users, UserCheck, Clock, CheckCircle } from "lucide-react";
import type {
  AdminStat,
  PendingVerification,
  RecentActivityItem,
} from "./types";


export const adminDashboardStats: AdminStat[] = [
  {
    title: "Pending Verifications",
    value: "12",
    icon: Clock,
    colorClass: "bg-yellow-500",
    change: "+3 today",
  },
  {
    title: "Active Registrars",
    value: "8",
    icon: UserCheck,
    colorClass: "bg-green-500",
    change: "2 online",
  },
  {
    title: "Total Users",
    value: "1,248",
    icon: Users,
    colorClass: "bg-blue-500",
    change: "+45 this week",
  },
  {
    title: "Verified Today",
    value: "23",
    icon: CheckCircle,
    colorClass: "bg-purple-500",
    change: "18 approved",
  },
];

export const adminRecentActivity: RecentActivityItem[] = [
  {
    id: 1,
    user: "Adv. Fatima Ali",
    action: "Lawyer verification approved",
    time: "5 minutes ago",
    status: "success",
  },
  {
    id: 2,
    user: "Muhammad Asif (Registrar)",
    action: "Created new registrar account",
    time: "1 hour ago",
    status: "info",
  },
  {
    id: 3,
    user: "Ahmed Khan",
    action: "Client verification approved",
    time: "2 hours ago",
    status: "success",
  },
  {
    id: 4,
    user: "Registrar Ali Hassan",
    action: "Processed 5 case files",
    time: "3 hours ago",
    status: "info",
  },
];

export const adminPendingVerifications: PendingVerification[] = [
  {
    id: 1,
    name: "Ayesha Khan",
    type: "Lawyer",
    email: "ayesha.khan@gmail.com",
    submitted: "2 hours ago",
    documents: ["CNIC", "Bar License", "Law Degree"],
  },
  {
    id: 2,
    name: "Ali Hassan",
    type: "Client",
    email: "ali.hassan@gmail.com",
    submitted: "4 hours ago",
    documents: ["CNIC"],
  },
  {
    id: 3,
    name: "Sara Ahmed",
    type: "Lawyer",
    email: "sara.ahmed@gmail.com",
    submitted: "6 hours ago",
    documents: ["CNIC", "Bar License", "Law Degree"],
  },
];
