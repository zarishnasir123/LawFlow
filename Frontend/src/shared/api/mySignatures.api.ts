import axios from "axios";

import { apiClient } from "./axios";

// Recipient-side signature endpoints. Used by BOTH:
//   - the client app (Pending Signatures dashboard, ClientSignatureViewer)
//   - the lawyer app when the lawyer is signing their own assigned pages
// Lives in shared/ instead of either module folder so neither side
// reaches across module boundaries.

export type SignerRole = "client" | "lawyer";
export type SignatureRequestStatus =
  | "pending"
  | "signed"
  | "expired"
  | "cancelled";

// Pending list returns one extra denormalized field (caseTitle) and the
// requesting lawyer's display name so the dashboard can render rows
// without a second fetch.
export type ApiPendingSignature = {
  id: string;
  caseId: string;
  caseTitle: string;
  createdByUserId: string;
  recipientUserId: string;
  signerRole: SignerRole;
  caseBatchId: string | null;
  pageIndices: number[] | null;
  signedAt: string | null;
  status: SignatureRequestStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  requestingLawyerName: string;
};

// Detail view: includes the frozen HTML snapshot so the viewer can render
// the document the lawyer sent.
export type ApiSignatureRequestDetail = {
  id: string;
  caseId: string;
  caseTitle: string;
  createdByUserId: string;
  recipientUserId: string;
  signerRole: SignerRole;
  caseBatchId: string | null;
  pageIndices: number[] | null;
  documentHtmlSnapshot: string;
  signedAt: string | null;
  status: SignatureRequestStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

// PNG-per-assigned-page captured on the signer's device at submit time.
// These bytes ARE the truth for the final signed PDF — the compiler
// embeds them verbatim, no re-rendering, no layout drift. One entry
// per page index in the signature_request.page_indices array.
export type SignedPageCapture = {
  pageIndex: number;
  imageDataUrl: string;
};

export const mySignaturesApi = {
  // List MY pending signatures (works for client + lawyer alike).
  listPending: async (): Promise<ApiPendingSignature[]> => {
    const { data } = await apiClient.get<{
      signatureRequests: ApiPendingSignature[];
    }>(`/me/signature-requests`);
    return data.signatureRequests;
  },

  // List MY terminal-state signature requests — cancelled (lawyer
  // withdrew), signed (I already completed), and pending-but-expired
  // rows. Powers the client dashboard's Activity log so the
  // recipient can audit "did the lawyer pull that back?" or "did I
  // sign that already?" in-app instead of through email.
  listHistory: async (): Promise<ApiPendingSignature[]> => {
    const { data } = await apiClient.get<{
      signatureRequests: ApiPendingSignature[];
    }>(`/me/signature-requests/history`);
    return data.signatureRequests;
  },

  // Fetch one request for the signing UI — server gates access by
  // recipient_user_id matching the authenticated user.
  getOne: async (requestId: string): Promise<ApiSignatureRequestDetail> => {
    const { data } = await apiClient.get<{
      signatureRequest: ApiSignatureRequestDetail;
    }>(`/me/signature-requests/${requestId}`);
    return data.signatureRequest;
  },

  // Submit a signature. `signedPages` carries one PNG per assigned page
  // — captured by the viewer AFTER the signer drag-placed their
  // signature — and is what the compiler embeds verbatim into the final
  // signed PDF.
  submit: async (
    requestId: string,
    signatureImage: string,
    signedPages?: SignedPageCapture[]
  ): Promise<ApiSignatureRequestDetail> => {
    const { data } = await apiClient.post<{
      signatureRequest: ApiSignatureRequestDetail;
    }>(`/me/signature-requests/${requestId}/sign`, {
      signatureImage,
      signedPages: signedPages ?? null,
    });
    return data.signatureRequest;
  },
};

export function getMySignaturesErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ??
      error.message
    );
  }
  return "Unexpected error. Please try again.";
}

// The lawyer's signature panel ships a snapshot of the WHOLE editor
// HTML (all pages + docx-preview's injected stylesheets). The signing
// viewer should only show the pages assigned to THIS signer though —
// otherwise the client browses the full case file instead of just the
// pages the lawyer asked them to sign. This helper rewrites the
// snapshot in-place: drops every <section.docx> whose 0-based index
// isn't in `pageIndices`. Leaves the surrounding <html>/<head> intact
// so docx-preview's CSS (page sizes, fonts) still applies to whatever
// remains.
export function filterSnapshotToPages(
  html: string,
  pageIndices: number[] | null
): string {
  if (!html || !pageIndices || pageIndices.length === 0) return html;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const wrapper = doc.querySelector(".docx-wrapper");
    if (!wrapper) return html;
    const sections = Array.from(
      wrapper.querySelectorAll(":scope > section.docx")
    );
    const keep = new Set(pageIndices);
    sections.forEach((section, idx) => {
      if (!keep.has(idx)) section.remove();
    });
    return `<!doctype html>${doc.documentElement.outerHTML}`;
  } catch {
    // If anything in the parse fails, fall back to the unfiltered HTML —
    // showing too much is better than showing nothing at all.
    return html;
  }
}
