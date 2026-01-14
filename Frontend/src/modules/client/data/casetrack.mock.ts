import {
  FileText,
  CheckCircle,
  Scale,
  ClipboardCheck,
  Calendar,
  Clock,
} from "lucide-react";

export const caseInfo = {
  caseNumber: "LC-2024-0156",
  status: "Hearing Scheduled",
  title: "Property Dispute Resolution",
  category: "Civil Law",
  filedDate: "January 15, 2025",
  client: "Ahmed Khan",
  lawyer: "Adv. Fatima Ali",
};

export const timeline = [
  {
    title: "Case Filed",
    description: "Initial case documentation submitted",
    date: "January 15, 2025",
    time: "11:00 AM",
    icon: FileText,
    status: "Completed",
  },
  {
    title: "Documents Verified",
    description: "All required documents verified by the system",
    date: "January 16, 2025",
    time: "02:15 PM",
    icon: CheckCircle,
    status: "Completed",
  },
  {
    title: "Submitted to Registrar",
    description: "Case file submitted for registrar review",
    date: "January 17, 2025",
    time: "11:00 AM",
    icon: Scale,
    status: "Completed",
  },
  {
    title: "Case Approved",
    description: "Registrar approved the case for court proceedings",
    date: "January 20, 2025",
    time: "07:45 AM",
    icon: ClipboardCheck,
    status: "Completed",
  },
  {
    title: "Hearing Scheduled",
    description: "First hearing scheduled for January 30, 2025 at 10:00 AM",
    date: "January 22, 2025",
    time: "03:00 PM",
    icon: Calendar,
    status: "In Progress",
  },
  {
    title: "Hearing Date",
    description: "Awaiting hearing on the scheduled date",
    date: "January 30, 2025",
    time: "10:00 AM",
    icon: Clock,
    status: "Pending",
  },
];
