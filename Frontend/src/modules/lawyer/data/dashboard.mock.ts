import {
  Calendar,
  DollarSign,
  FileText,
  FolderOpen,
  MessageCircle,
  Sparkles,
  CreditCard,
  Briefcase,
} from "lucide-react";
import type {
  ActivityItem,
  CaseItem,
  DashboardStat,
  HearingItem,
  QuickActionItem,
} from "../../../shared/types/dashboard";

export const lawyerDashboardStats: DashboardStat[] = [
  { label: "Active Cases", value: "8", icon: FileText, accentClassName: "bg-blue-500" },
  {
    label: "Pending Submissions",
    value: "2",
    icon: FolderOpen,
    accentClassName: "bg-yellow-500",
  },
  {
    label: "Client Messages",
    value: "5",
    icon: MessageCircle,
    accentClassName: "bg-green-500",
  },
  {
    label: "Total Earnings",
    value: "Rs. 450K",
    icon: DollarSign,
    accentClassName: "bg-purple-500",
  },
];

export const lawyerDashboardQuickActions: QuickActionItem[] = [
  {
    label: "New Case",
    icon: FileText,
    className: "bg-[#01411C] hover:bg-[#024a23]",
    to: "/lawyer-new-case",
  },
  {
    label: "My Cases",
    icon: Briefcase,
    className: "bg-[#01411C] hover:bg-[#024a23]",
    to: "/lawyer-cases",
  },
  {
    label: "Returned Cases",
    icon: FolderOpen,
    className: "bg-rose-700 hover:bg-rose-800",
    to: "/lawyer-returned-cases",
  },
  {
    label: "AI Assistant",
    icon: Sparkles,
    className: "bg-[#01411C] hover:bg-[#024a23]",
    to: "/lawyer-ai-guidance",
  },
  {
    label: "Signatures",
    icon: FileText,
    className: "bg-[#01411C] hover:bg-[#024a23]",
    to: "/lawyer-signatures",
  },
  {
    label: "Messages",
    icon: MessageCircle,
    className: "bg-[#01411C] hover:bg-[#024a23]",
    to: "/lawyer-messages",
  },
  {
    label: "Hearings",
    icon: Calendar,
    className: "bg-[#01411C] hover:bg-[#024a23]",
    to: "/lawyer-hearings",
  },
  {
    label: "Service Charges",
    icon: CreditCard,
    className: "bg-[#01411C] hover:bg-[#024a23]",
    to: "/lawyer-service-charges",
  },
  {
    label: "Case Payments",
    icon: DollarSign,
    className: "bg-[#01411C] hover:bg-[#024a23]",
    to: "/lawyer-case-payments",
  },
];

export const lawyerDashboardCases: CaseItem[] = [
  {
    id: 1,
    caseNumber: "LC-2024-0156",
    title: "Property Dispute Resolution",
    lawyer: "Ahmed Khan",
    status: "Hearing Scheduled",
    lastUpdate: "Today",
    nextHearing: "January 30, 2025",
  },
  {
    id: 2,
    caseNumber: "LC-2024-0142",
    title: "Contract Breach Settlement",
    lawyer: "Ali Hassan",
    status: "In Review",
    lastUpdate: "Yesterday",
    nextHearing: "February 5, 2025",
  },
];

export const lawyerDashboardHearings: HearingItem[] = [
  {
    id: 1,
    caseNumber: "LC-2024-0156",
    title: "Property Dispute",
    dateTime: "January 30, 2025 - 10:00 AM",
  },
];

export const lawyerDashboardActivity: ActivityItem[] = [
  { id: 1, label: "Case approved by registrar", time: "1 hour ago", type: "case" },
  { id: 2, label: "New message from client", time: "3 hours ago", type: "message" },
];

