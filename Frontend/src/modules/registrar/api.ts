import axios from "axios";

import { apiClient } from "../../shared/api/axios";
import type { AuthResponse, RegistrarLoginPayload } from "../auth/types";

// Posts to the shared /auth/login endpoint (same as client and lawyer);
// passes expectedRole so the backend rejects the attempt if these
// credentials happen to belong to a different role. The dedicated
// /auth/login/registrar endpoint this previously called never existed
// in the backend — the registrar login was silently broken end-to-end.
export async function loginRegistrar(
  payload: RegistrarLoginPayload
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", {
    ...payload,
    expectedRole: "registrar",
  });
  return data;
}

// camelCase shapes returned by the registrar router (/api/registrar/*).
// These map from the real `cases` table columns server-side; the frontend
// only ever sees this projection.
export type RegistrarCaseStatus = "submitted" | "returned" | "accepted";

export type CaseSummary = {
  id: string;
  title: string;
  caseTypeLabel: string;
  category: string;
  clientName: string;
  lawyerName: string;
  status: RegistrarCaseStatus;
  submittedAt: string | null;
  assignedTehsil: string | null;
};

// Detail view adds the signed-PDF link plus the registrar's own review
// metadata. signedPdfUrl is a short-lived signed URL minted from
// cases.signed_pdf_storage_path; null when no signed PDF exists yet.
export type CaseDetail = CaseSummary & {
  signedPdfUrl: string | null;
  reviewRemarks: string | null;
  reviewedAt: string | null;
};

// (R1) The registrar's review queue: submitted cases routed to this
// registrar's tehsil, oldest-submitted first (FCFS, ordered server-side).
export async function listSubmittedCases(): Promise<CaseSummary[]> {
  const { data } = await apiClient.get<{ cases: CaseSummary[] }>(
    "/registrar/cases"
  );
  return data.cases;
}

// (R2) One case for the review screen. The backend 404s on a tehsil
// mismatch, so the registrar can only open cases in their jurisdiction.
export async function getCase(caseId: string): Promise<CaseDetail> {
  const { data } = await apiClient.get<{ case: CaseDetail }>(
    `/registrar/cases/${caseId}`
  );
  return data.case;
}

// (R3) Accept the case — moves status to 'accepted'.
export async function approveCase(caseId: string): Promise<CaseDetail> {
  const { data } = await apiClient.patch<{ case: CaseDetail }>(
    `/registrar/cases/${caseId}/approve`
  );
  return data.case;
}

// (R4) Send the case back to the lawyer with correction remarks. The
// backend rejects an empty/whitespace-only remarks string with a 400.
export async function returnCase(
  caseId: string,
  remarks: string
): Promise<CaseDetail> {
  const { data } = await apiClient.patch<{ case: CaseDetail }>(
    `/registrar/cases/${caseId}/return`,
    { remarks }
  );
  return data.case;
}

export function getRegistrarErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ??
      error.message
    );
  }

  return "Unexpected error. Please try again.";
}
