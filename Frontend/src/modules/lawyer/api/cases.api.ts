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
  // Lawyer's saved HTML edit state. NULL until first edit.
  editedHtml: string | null;
  // Signed-PDF artifact populated when every signature_request on the
  // case reaches status='signed' and the background compile finishes.
  // The path is internal; downloads go through short-lived signed URLs.
  signedPdfStoragePath: string | null;
  signedPdfGeneratedAt: string | null;
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

// Relative API path that streams the generated .docx for a given
// case_types.code. Building it here (not inline at call-sites) keeps the
// path in one place and lets the apiClient interceptor attach auth headers
// without us hand-rolling a fetch().
export function caseTemplateApiPath(code: string): string {
  return `/cases/types/${code}/template`;
}

export const casesApi = {
  listCaseTypes: async (): Promise<ApiCaseType[]> => {
    const { data } = await apiClient.get<{ caseTypes: ApiCaseType[] }>(
      "/cases/types"
    );
    return data.caseTypes;
  },

  // Download the .docx template bytes for a given case_types.code. Returns an
  // ArrayBuffer ready to feed straight into mammoth (now) or SuperDoc (Phase 2).
  // Authentication comes from the apiClient interceptor; we never expose the
  // template via a public URL because Module 3 Phase 2 will tie editable
  // templates to case ownership.
  fetchCaseTemplateBytes: async (code: string): Promise<ArrayBuffer> => {
    const { data } = await apiClient.get<ArrayBuffer>(
      caseTemplateApiPath(code),
      { responseType: "arraybuffer" }
    );
    return data;
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

  // Persist the editor's current HTML state to cases.edited_html.
  // Called by the auto-save loop in CaseDocumentEditor (on blur, on
  // 30s interval, and on manual Save Draft). The backend endpoint
  // lives in the signatures router (PUT /api/cases/:caseId/document)
  // because the snapshot flow originated there; functionally it's a
  // case-edit operation. Returns the row's updatedAt so the editor
  // can render "Saved 2m ago" in the title bar.
  saveEditedHtml: async (
    caseId: string,
    editedHtml: string
  ): Promise<{ updatedAt: string }> => {
    const { data } = await apiClient.put<{ updatedAt: string }>(
      `/cases/${caseId}/document`,
      { editedHtml }
    );
    return data;
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
