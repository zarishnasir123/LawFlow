import type { CaseSubmissionRecord } from "../../lawyer/types/caseFiling";

function createBundle(seed: string) {
  return {
    caseId: seed,
    generatedAt: "2026-02-20T10:00:00.000Z",
    orderedDocuments: [
      {
        id: `${seed}-doc-1`,
        title: "Plaint",
        category: "petition" as const,
        fileType: "pdf" as const,
        required: true,
        signedRequired: true,
        signedCompleted: true,
        source: "prepared_document" as const,
      },
      {
        id: `${seed}-doc-2`,
        title: "Affidavit",
        category: "supporting" as const,
        fileType: "pdf" as const,
        required: true,
        signedRequired: true,
        signedCompleted: true,
        source: "prepared_document" as const,
      },
      {
        id: `${seed}-doc-3`,
        title: "Vakalatnama",
        category: "supporting" as const,
        fileType: "pdf" as const,
        required: true,
        signedRequired: true,
        signedCompleted: true,
        source: "prepared_document" as const,
      },
    ],
    evidenceFiles: [
      {
        id: `${seed}-ev-1`,
        title: "Supporting Evidence Pack",
        fileType: "pdf" as const,
        sizeLabel: "2.4 MB",
        uploadedAt: "2026-02-19T14:00:00.000Z",
      },
    ],
    signatureSnapshot: {
      totalRequired: 3,
      completed: 3,
      pending: 0,
      allCompleted: true,
      items: [
        {
          id: `${seed}-doc-1`,
          documentTitle: "Plaint",
          required: true,
          completed: true,
        },
        {
          id: `${seed}-doc-2`,
          documentTitle: "Affidavit",
          required: true,
          completed: true,
        },
        {
          id: `${seed}-doc-3`,
          documentTitle: "Vakalatnama",
          required: true,
          completed: true,
        },
      ],
    },
  };
}

export const mockSubmittedCases: CaseSubmissionRecord[] = [
  {
    caseId: "mock-submitted-1",
    displayCaseId: "CF-2026-MK101",
    title: "Property Dispute Resolution",
    caseType: "civil",
    clientName: "Ali Raza",
    tehsil: "Model Town Tehsil",
    registrar: "Registrar Ayesha Malik",
    submittedBy: "Adv. Fatima Noor",
    submittedAt: "2026-02-18T09:30:00.000Z",
    status: "submitted",
    bundle: createBundle("mock-submitted-1"),
  },
  {
    caseId: "mock-submitted-2",
    displayCaseId: "CF-2026-MK102",
    title: "Land Ownership Issue",
    caseType: "civil",
    clientName: "Sara Khan",
    tehsil: "Cantt Tehsil",
    registrar: "Registrar Bilal Qureshi",
    submittedBy: "Adv. Hassan Akbar",
    submittedAt: "2026-02-19T11:45:00.000Z",
    status: "submitted",
    bundle: createBundle("mock-submitted-2"),
  },
  {
    caseId: "mock-submitted-3",
    displayCaseId: "CF-2026-MK103",
    title: "Child Custody Petition",
    caseType: "family",
    clientName: "Ayesha Tariq",
    tehsil: "City Tehsil",
    registrar: "Registrar Sana Tariq",
    submittedBy: "Adv. Umar Farooq",
    submittedAt: "2026-02-20T16:20:00.000Z",
    status: "submitted",
    bundle: createBundle("mock-submitted-3"),
  },
];
