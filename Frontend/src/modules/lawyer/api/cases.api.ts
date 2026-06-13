import axios from "axios";

import { apiClient } from "../../../shared/api/axios";

export type CaseCategory = "civil" | "family";
export type CaseStatus = "draft" | "submitted" | "returned" | "accepted";
export type CaseSignerRole = "client" | "lawyer";

// Court/tehsil jurisdictions the backend routes cases to. Mirrors the
// deployment's SUPPORTED_TEHSILS list (Backend/src/utils/location.js) — the
// lawyer picks one at case creation and it routes the case to the matching
// registrar. Keep this in sync with the backend list; an unsupported value is
// rejected with a 400 on create/submit.
export const SUPPORTED_TEHSILS = [
  "Gujranwala City & Sadar",
  "Kamoke",
  "Nowshera Virkan",
] as const;

export type SupportedTehsil = (typeof SUPPORTED_TEHSILS)[number];

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
  // Jurisdiction the case is routed to; chosen by the lawyer at creation and
  // required before the case can be submitted to a registrar.
  assignedTehsil: string | null;
  // Registrar review trail. `reviewRemarks` is the return reason the registrar
  // writes when a submitted case is sent back; it's what the lawyer must read
  // and address before resubmitting.
  reviewRemarks: string | null;
  reviewedAt: string | null;
  reviewedByRegistrarId: string | null;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  // Distinct signer roles whose signature_request reached status='signed'
  // for this case. Only populated by /cases/signed; other endpoints omit
  // the field. Drives the "Client + Lawyer" / "Client only" badge on the
  // Signed Documents tracker so the lawyer can tell counter-signed
  // artifacts apart from self-signed ones at a glance.
  signedByRoles?: CaseSignerRole[];
};

export type CreateCasePayload = {
  caseTypeId: string;
  title: string;
  description?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  oppositePartyName: string;
  // Court/tehsil jurisdiction. Validated server-side against the supported
  // list; must be one of SUPPORTED_TEHSILS.
  assignedTehsil: string;
};

export type UpdateCasePayload = Partial<Omit<CreateCasePayload, "caseTypeId">>;

// Case attachment record returned by the backend. `url` is a fresh
// signed Supabase URL (1-hour TTL) the editor can drop straight into
// an <img src>. `storagePath` is the durable identifier; on every
// case re-open we ask the backend for a fresh `url`.
export type ApiCaseAttachment = {
  id: string;
  caseId: string;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
  storageBucket: string;
  storagePath: string;
  createdAt: string;
  url: string | null;
};

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

  // Only cases where the PDF compile has produced a downloadable
  // artifact (signed_pdf_storage_path IS NOT NULL). Used by the
  // dedicated "Signed Documents" tracker on /lawyer-signatures.
  listMySignedCases: async (): Promise<ApiCase[]> => {
    const { data } = await apiClient.get<{ cases: ApiCase[] }>(
      "/cases/signed"
    );
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

  // Submit the case to the registrar for review. The backend enforces the
  // prerequisites (status must be 'draft' or 'returned', a tehsil must be set,
  // and the case file must be signed) and returns a specific 400 message when
  // one is missing — surface it via getCasesErrorMessage. No request body: the
  // case id in the URL is all the endpoint needs. Returns the updated case
  // (status='submitted'), so callers can reflect the real server result.
  submitCase: async (caseId: string): Promise<ApiCase> => {
    const { data } = await apiClient.post<{ case: ApiCase }>(
      `/cases/${caseId}/submit`
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

  // Upload a single image attachment to a case. Multipart form, field
  // name "file" — must match the multer config on the backend. Returns
  // the persisted record including a fresh signed URL for immediate
  // use in the editor.
  uploadAttachment: async (
    caseId: string,
    file: File
  ): Promise<ApiCaseAttachment> => {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await apiClient.post<{ attachment: ApiCaseAttachment }>(
      `/cases/${caseId}/attachments`,
      formData
    );
    return data.attachment;
  },

  // Fetch the current attachment list for a case. Every URL is freshly
  // minted with a 1-hour TTL, so calling this on case open is what
  // makes the editor's restored HTML survive past the previous URL's
  // expiry — the floating-image src gets rewritten with these.
  listAttachments: async (caseId: string): Promise<ApiCaseAttachment[]> => {
    const { data } = await apiClient.get<{ attachments: ApiCaseAttachment[] }>(
      `/cases/${caseId}/attachments`
    );
    return data.attachments;
  },

  deleteAttachment: async (
    caseId: string,
    attachmentId: string
  ): Promise<void> => {
    await apiClient.delete(`/cases/${caseId}/attachments/${attachmentId}`);
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
