export type ClientCaseStatus = "active" | "in_review" | "hearing_scheduled" | "completed";

export type ClientCaseSummary = {
  id: string;
  title: string;
  type: "civil" | "family";
  status: ClientCaseStatus;
  summary: string;
  filedOn: string;
  nextHearing: string;
  lawyer: {
    name: string;
    email: string;
    phone: string;
    specialization: string;
  };
};

const CASES_BY_CLIENT_EMAIL: Record<string, ClientCaseSummary[]> = {
  "ahmed.khan@email.com": [
    {
      id: "client-case-1",
      title: "Property Dispute Resolution",
      type: "civil",
      status: "hearing_scheduled",
      summary: "Boundary and ownership dispute of a residential property.",
      filedOn: "January 15, 2025",
      nextHearing: "January 30, 2025",
      lawyer: {
        name: "Adv. Fatima Ali",
        email: "fatima.ali@lawflow.pk",
        phone: "+92 300 1112233",
        specialization: "Civil Property Litigation",
      },
    },
    {
      id: "client-case-2",
      title: "Contract Breach Settlement",
      type: "civil",
      status: "in_review",
      summary: "Recovery and settlement for breach of service agreement.",
      filedOn: "February 5, 2025",
      nextHearing: "February 18, 2025",
      lawyer: {
        name: "Adv. Hassan Ahmed",
        email: "hassan.ahmed@lawflow.pk",
        phone: "+92 300 4422199",
        specialization: "Contract and Commercial Disputes",
      },
    },
  ],
};

const DEFAULT_CLIENT_CASES: ClientCaseSummary[] = [
  {
    id: "client-default-1",
    title: "Case File",
    type: "civil",
    status: "active",
    summary: "Case is active and currently being handled by assigned counsel.",
    filedOn: "February 1, 2025",
    nextHearing: "To be scheduled",
    lawyer: {
      name: "Adv. Assigned Lawyer",
      email: "assigned.lawyer@lawflow.pk",
      phone: "+92 300 0000000",
      specialization: "General Civil Practice",
    },
  },
];

export function getClientCasesForEmail(email?: string) {
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail) return DEFAULT_CLIENT_CASES;
  return CASES_BY_CLIENT_EMAIL[normalizedEmail] || DEFAULT_CLIENT_CASES;
}
