interface Hearing {
  id: string;
  caseNumber: string;
  caseTitle: string;
  client: string;
  caseType: "civil" | "family";
  courtName: string;
  location: string;
  dateTime: string;
  judge?: string;
  status: "upcoming" | "completed" | "postponed" | "adjourned";
  notes?: string;
  nextHearing?: string;
}

export const getInitialHearings = (): Hearing[] => [
  // Civil Cases - Gujranwala District Court
  {
    id: "H-001",
    caseNumber: "LC-2024-0156",
    caseTitle: "Property Dispute Resolution",
    client: "Ahmed Khan",
    caseType: "civil",
    courtName: "District Court, Gujranwala",
    location: "Court Room 3, Ground Floor, District Court Gujranwala",
    dateTime: "January 30, 2025 - 10:00 AM",
    judge: "Hon. Justice Muhammad Iqbal",
    status: "upcoming",
    notes: "Please bring all original documents and witnesses.",
    nextHearing: "February 20, 2025",
  },
  {
    id: "H-002",
    caseNumber: "LC-2024-0142",
    caseTitle: "Contract Breach Settlement",
    client: "Fatima Ahmed",
    caseType: "civil",
    courtName: "District Court, Gujranwala",
    location: "Court Room 5, First Floor, District Court Gujranwala",
    dateTime: "February 5, 2025 - 02:30 PM",
    judge: "Hon. Justice Rana Hassan",
    status: "upcoming",
    nextHearing: "March 10, 2025",
  },
  {
    id: "H-005",
    caseNumber: "LC-2024-0120",
    caseTitle: "Property Possession Case",
    client: "Hassan Raza",
    caseType: "civil",
    courtName: "District Court, Gujranwala",
    location: "Court Room 2, Ground Floor, District Court Gujranwala",
    dateTime: "January 22, 2025 - 09:00 AM",
    judge: "Hon. Justice Muhammad Anwar",
    status: "completed",
    notes: "Case adjourned to February 15, 2025",
    nextHearing: "February 15, 2025",
  },
  {
    id: "H-007",
    caseNumber: "LC-2024-0198",
    caseTitle: "Recovery of Money",
    client: "Muhammad Hassan",
    caseType: "civil",
    courtName: "District Court, Gujranwala",
    location: "Court Room 7, Second Floor, District Court Gujranwala",
    dateTime: "February 10, 2025 - 11:30 AM",
    judge: "Hon. Justice Saira Yousaf",
    status: "upcoming",
    notes: "Bring bank statements and transaction records",
  },

  // Family Cases - Gujranwala District Court
  {
    id: "H-003",
    caseNumber: "LC-2024-0189",
    caseTitle: "Khula (Divorce) Proceeding",
    client: "Zainab Malik",
    caseType: "family",
    courtName: "District Court, Gujranwala",
    location: "Court Room 3, Second Floor, District Court Gujranwala",
    dateTime: "February 12, 2025 - 11:00 AM",
    judge: "Hon. Justice Saira Yousaf",
    status: "upcoming",
    notes: "Bring all relevant documents and witnesses list",
    nextHearing: "March 5, 2025",
  },
  {
    id: "H-004",
    caseNumber: "LC-2024-0145",
    caseTitle: "Maintenance Suit (Family)",
    client: "Hira Ali",
    caseType: "family",
    courtName: "District Court, Gujranwala",
    location: "Court Room 6, First Floor, District Court Gujranwala",
    dateTime: "January 25, 2025 - 03:00 PM",
    judge: "Hon. Justice Ayesha Khan",
    status: "upcoming",
  },
  {
    id: "H-006",
    caseNumber: "LC-2024-0167",
    caseTitle: "Dowry Recovery Case",
    client: "Aisha Khan",
    caseType: "family",
    courtName: "District Court, Gujranwala",
    location: "Court Room 4, Second Floor, District Court Gujranwala",
    dateTime: "January 20, 2025 - 01:30 PM",
    judge: "Hon. Justice Sana Iqbal",
    status: "postponed",
    notes: "Postponed due to judge's medical emergency",
  },
  {
    id: "H-008",
    caseNumber: "LC-2024-0205",
    caseTitle: "Custody of Minors",
    client: "Salman Iqbal",
    caseType: "family",
    courtName: "District Court, Gujranwala",
    location: "Court Room 8, First Floor, District Court Gujranwala",
    dateTime: "February 18, 2025 - 04:00 PM",
    judge: "Hon. Justice Amina Malik",
    status: "upcoming",
    notes: "Please bring children for assessment interview",
    nextHearing: "March 18, 2025",
  },
];
