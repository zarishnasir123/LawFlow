import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CaseSubmissionRecord } from "../../lawyer/types/caseFiling";

type ReviewStatus = "returned" | "approved";

type ReviewDecision = {
  status: ReviewStatus;
  decidedAt: string;
  remarks?: string;
};

export type ReturnedCaseRecord = {
  caseId: string;
  title: string;
  caseType: "civil" | "family";
  clientName: string;
  submittedBy: string;
  tehsil: string;
  registrar: string;
  submittedAt: string;
  returnedAt: string;
  remarks: string;
};

type ReviewDecisionState = {
  decisionsByCaseId: Record<string, ReviewDecision>;
  returnedCases: ReturnedCaseRecord[];
  markCaseReturned: (input: {
    caseData: CaseSubmissionRecord;
    remarks: string;
  }) => void;
  markCaseApproved: (input: { caseData: CaseSubmissionRecord }) => void;
  getDecision: (caseId: string) => ReviewDecision | undefined;
};

export const useRegistrarReviewDecisionStore = create<ReviewDecisionState>()(
  persist(
    (set, get) => ({
      decisionsByCaseId: {},
      returnedCases: [],

      markCaseReturned: ({ caseData, remarks }) => {
        const decidedAt = new Date().toISOString();
        const trimmedRemarks = remarks.trim();
        set((state) => ({
          decisionsByCaseId: {
            ...state.decisionsByCaseId,
            [caseData.caseId]: {
              status: "returned",
              decidedAt,
              remarks: trimmedRemarks,
            },
          },
          returnedCases: [
            {
              caseId: caseData.caseId,
              title: caseData.title,
              caseType: caseData.caseType,
              clientName: caseData.clientName,
              submittedBy: caseData.submittedBy,
              tehsil: caseData.tehsil,
              registrar: caseData.registrar,
              submittedAt: caseData.submittedAt,
              returnedAt: decidedAt,
              remarks: trimmedRemarks,
            },
            ...state.returnedCases.filter((item) => item.caseId !== caseData.caseId),
          ],
        }));
      },

      markCaseApproved: ({ caseData }) => {
        const decidedAt = new Date().toISOString();
        set((state) => ({
          decisionsByCaseId: {
            ...state.decisionsByCaseId,
            [caseData.caseId]: {
              status: "approved",
              decidedAt,
            },
          },
          returnedCases: state.returnedCases.filter(
            (item) => item.caseId !== caseData.caseId
          ),
        }));
      },

      getDecision: (caseId) => get().decisionsByCaseId[caseId],
    }),
    {
      name: "lawflow_registrar_review_decisions",
    }
  )
);
