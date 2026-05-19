import axios from "axios";

import { apiClient } from "../../../shared/api/axios";

export type CaseCategory = "civil" | "family";
export type CaseStatus = "draft" | "submitted" | "returned" | "accepted";

export type ApiCaseType = {
  id: string;
  category: CaseCategory;
  code: string;
  displayName: string;
  governingLaw: string | null;
  sortOrder: number;
};

export type ApiCase = {
  id: string;
  lawyerUserId: string;
  caseTypeId: string;
  caseTypeCode: string;
  caseTypeName: string;
  caseCategory: CaseCategory;
  governingLaw: string | null;
  title: string;
  description: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  oppositePartyName: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
};

export type CreateCasePayload = {
  caseTypeId: string;
  title: string;
  description?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  oppositePartyName: string;
};

export type UpdateCasePayload = Partial<Omit<CreateCasePayload, "caseTypeId">>;

export const casesApi = {
  listCaseTypes: async (): Promise<ApiCaseType[]> => {
    const { data } = await apiClient.get<{ caseTypes: ApiCaseType[] }>(
      "/cases/types"
    );
    return data.caseTypes;
  },

  listMyCases: async (): Promise<ApiCase[]> => {
    const { data } = await apiClient.get<{ cases: ApiCase[] }>("/cases");
    return data.cases;
  },

  getCase: async (caseId: string): Promise<ApiCase> => {
    const { data } = await apiClient.get<{ case: ApiCase }>(`/cases/${caseId}`);
    return data.case;
  },

  createCase: async (payload: CreateCasePayload): Promise<ApiCase> => {
    const { data } = await apiClient.post<{ case: ApiCase }>("/cases", payload);
    return data.case;
  },

  updateCase: async (
    caseId: string,
    payload: UpdateCasePayload
  ): Promise<ApiCase> => {
    const { data } = await apiClient.patch<{ case: ApiCase }>(
      `/cases/${caseId}`,
      payload
    );
    return data.case;
  },
};

export function getCasesErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ??
      error.message
    );
  }

  return "Unexpected error. Please try again.";
}
