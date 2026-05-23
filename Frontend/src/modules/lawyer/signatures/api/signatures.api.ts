import axios from "axios";

import { apiClient } from "../../../../shared/api/axios";

// ===== Server DTOs =====

export type SignerRole = "client" | "lawyer";
export type SignatureRequestStatus =
  | "pending"
  | "signed"
  | "expired"
  | "cancelled";

// Position metadata for a captured signature — page-fractional so
// it survives any A4/letter rescale at compile time.
export type ApiSignaturePlacement = {
  pageIndex: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
};

// Mirrors the shape returned by signatures.service.js → mapSignatureRequest.
// `documentHtmlSnapshot` and `signatureImage` are opt-in on the server; we
// type them as optional so list endpoints don't claim values they don't ship.
export type ApiSignatureRequest = {
  id: string;
  caseId: string;
  createdByUserId: string;
  recipientUserId: string;
  signerRole: SignerRole;
  caseBatchId: string | null;
  pageIndices: number[] | null;
  signedAt: string | null;
  signaturePlacement: ApiSignaturePlacement | null;
  status: SignatureRequestStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  documentHtmlSnapshot?: string;
  signatureImage?: string;
};

// Returned by GET /api/cases/:caseId/signature-requests alongside the list:
// a rolled-up "is this case fully signed yet?" so the editor doesn't have
// to recompute it client-side.
export type CaseSignatureCompletion = {
  total: number;
  signedCount: number;
  openCount: number;
  fullySigned: boolean;
};

// Lawyer-side: what the editor's signature panel posts on Send.
//   - clientEmail: required when ANY page assigns a 'client' signer.
//     The server resolves it to a recipient_user_id and rejects if no
//     LawFlow client exists for that email.
//   - pageAssignments: per-page who must sign. The server splits this
//     into one signature_request row per signer.
//   - documentHtmlSnapshot: the live editor HTML (page sections +
//     docx-preview's injected stylesheets) so the recipient sees the
//     exact same formatting the lawyer was looking at. The server
//     uses this as the frozen snapshot AND saves it back to
//     cases.edited_html as a side effect.
export type CreateSignatureRequestPayload = {
  clientEmail?: string;
  pageAssignments: Array<{
    pageIndex: number;
    signers: SignerRole[];
  }>;
  documentHtmlSnapshot: string;
};

export const signaturesApi = {
  // ===== Lawyer-side (case-scoped) =====

  // List every signature request on a case + the overall completion
  // state. The editor polls this so the Signatures button badge stays
  // fresh.
  listForCase: async (
    caseId: string
  ): Promise<{
    signatureRequests: ApiSignatureRequest[];
    completion: CaseSignatureCompletion;
  }> => {
    const { data } = await apiClient.get<{
      signatureRequests: ApiSignatureRequest[];
      completion: CaseSignatureCompletion;
    }>(`/cases/${caseId}/signature-requests`);
    return data;
  },

  // Send a batch of signature requests. Server creates 1 row per signer
  // and returns them grouped by batchId.
  create: async (
    caseId: string,
    payload: CreateSignatureRequestPayload
  ): Promise<{
    batchId: string;
    signatureRequests: ApiSignatureRequest[];
  }> => {
    const { data } = await apiClient.post<{
      batchId: string;
      signatureRequests: ApiSignatureRequest[];
    }>(`/cases/${caseId}/signature-requests`, payload);
    return data;
  },

  // Cancel a request before the signer signs. Server keeps the row but
  // flips status to 'cancelled'.
  cancel: async (
    caseId: string,
    requestId: string
  ): Promise<ApiSignatureRequest> => {
    const { data } = await apiClient.delete<{
      signatureRequest: ApiSignatureRequest;
    }>(`/cases/${caseId}/signature-requests/${requestId}`);
    return data.signatureRequest;
  },

  // Get a short-lived signed URL for the case's compiled signed PDF.
  // Backend returns 409 if signing isn't complete yet. URL expires in
  // 5 minutes; frontend should fetch fresh each time the lawyer hits
  // Download rather than caching client-side.
  downloadSignedPdf: async (
    caseId: string
  ): Promise<{ downloadUrl: string; expiresInSeconds: number; generatedAt: string }> => {
    const { data } = await apiClient.get<{
      downloadUrl: string;
      expiresInSeconds: number;
      generatedAt: string;
    }>(`/cases/${caseId}/signed-pdf`);
    return data;
  },
};

// Shared helper — extracts a human-readable message from an axios error
// for toast/alert display. Mirrors getCasesErrorMessage in cases.api.ts.
export function getSignaturesErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ??
      error.message
    );
  }
  return "Unexpected error. Please try again.";
}
