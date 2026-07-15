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
  // The registrar's decision time (cases.reviewed_at): set when a case is
  // accepted or returned, null while still submitted. Drives the accepted /
  // returned lists' "decision date" and the dashboard "Processed Today" count.
  reviewedAt: string | null;
  assignedTehsil: string | null;
};

// A single document attached to the case (an image / evidence file the
// lawyer uploaded). url is a freshly-minted, short-lived signed view URL
// from the storage service; null when minting failed server-side.
export type RegistrarCaseAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  url: string | null;
};

// Detail view adds the complete case file plus the registrar's own review
// metadata.
//   - signedPdfUrl: short-lived signed URL minted from
//     cases.signed_pdf_storage_path; null when no signed PDF exists yet.
//     This is only the signed page(s), not the whole file.
//   - editedHtml: the prepared-document HTML snapshot (cases.edited_html,
//     the same value the lawyer's getCase returns). The full multi-section
//     plaint. Inline images point at the signed URLs from when the lawyer
//     last saved — those expire after an hour, so the review page re-points
//     them at the fresh `attachments[].url` values below. null when the
//     lawyer has not built the document yet.
//   - signedPageIndices: sorted, de-duplicated 0-based absolute page indices
//     that carry a completed signature for this case (union of every signed
//     signature_request's page_indices). Used to overlay the signed-page
//     captures pulled out of signedPdfUrl onto the matching sections of the
//     edited document, so the registrar sees one complete file with the
//     signatures in place. [] when there are no signed pages.
//   - attachments: every row in case_attachments for this case, each with a
//     fresh signed view URL.
export type CaseDetail = CaseSummary & {
  signedPdfUrl: string | null;
  editedHtml: string | null;
  signedPageIndices: number[];
  // Per-page signer breakdown for the review sidebar's "who signed" badges:
  // which signer(s) completed each page (client, lawyer, or both). Only the
  // signer ROLE is exposed — never a name or any PII.
  pageSignatures: {
    pageIndex: number;
    clientSigned: boolean;
    lawyerSigned: boolean;
  }[];
  attachments: RegistrarCaseAttachment[];
  reviewRemarks: string | null;
  reviewedAt: string | null;
};

// (R1) The registrar's case lists, filtered by lifecycle status within the
// registrar's tehsil. The backend orders server-side:
//   - submitted -> submitted_at ASC (queue / oldest first)
//   - accepted / returned -> reviewed_at DESC (most recent decision first)
// Defaults to "submitted" so the existing review-queue callers keep working.
export async function listCases(
  status: RegistrarCaseStatus = "submitted"
): Promise<CaseSummary[]> {
  const { data } = await apiClient.get<{ cases: CaseSummary[] }>(
    "/registrar/cases",
    { params: { status } }
  );
  return data.cases;
}

// Back-compat alias for the review-queue callers (defaults to submitted).
export async function listSubmittedCases(): Promise<CaseSummary[]> {
  return listCases("submitted");
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

export type HearingStatus = "proposed" | "scheduled" | "completed" | "adjourned" | "cancelled";
export type HearingOutcomeType = "completed" | "adjourned" | "disposed";

export type Courtroom = {
  id: string;
  name: string;
};

export type Holiday = {
  id: string;
  date: string;
  reason: string;
};

export type Hearing = {
  id: string;
  caseId: string;
  caseTitle: string;
  caseStatus: string;
  lawyerUserId: string;
  lawyerName: string | null;
  courtroomId: string;
  courtroomName: string;
  hearingNumber: number;
  hearingType: string;
  hearingDate: string;
  startTime: string;
  endTime: string;
  status: HearingStatus;
  createdByRegistrarId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HearingProposal = {
  needsManualScheduling: boolean;
  caseId?: string;
  caseTitle?: string;
  lawyerUserId?: string;
  courtroomId?: string;
  courtroomName?: string;
  hearingNumber: number;
  hearingType: string;
  hearingDate?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
};

// Hearing API calls
export async function proposeHearing(caseId: string): Promise<HearingProposal> {
  const { data } = await apiClient.get<{ proposal: HearingProposal }>(
    `/hearings/cases/${caseId}/propose`
  );
  return data.proposal;
}

export async function confirmHearing(
  caseId: string,
  payload: {
    date: string;
    startTime: string;
    courtroomId: string;
    hearingType: string;
  }
): Promise<Hearing> {
  const { data } = await apiClient.post<{ hearing: Hearing }>(
    `/hearings/cases/${caseId}/confirm`,
    payload
  );
  return data.hearing;
}

export async function listCaseHearings(caseId: string): Promise<Hearing[]> {
  const { data } = await apiClient.get<{ hearings: Hearing[] }>(
    `/hearings/cases/${caseId}`
  );
  return data.hearings;
}

export async function recordOutcome(
  hearingId: string,
  payload: {
    outcome: HearingOutcomeType;
    remarks?: string;
    nextHearingType?: string;
  }
): Promise<{ hearingId: string; outcome: HearingOutcomeType; status: string }> {
  const { data } = await apiClient.post<{
    outcome: { hearingId: string; outcome: HearingOutcomeType; status: string };
  }>(`/hearings/${hearingId}/outcome`, payload);
  return data.outcome;
}

export async function rescheduleHearing(
  hearingId: string,
  payload: {
    newDate: string;
    newStartTime: string;
    newCourtroomId: string;
  }
): Promise<Hearing> {
  const { data } = await apiClient.patch<{ hearing: Hearing }>(
    `/hearings/${hearingId}/reschedule`,
    payload
  );
  return data.hearing;
}

export async function cancelHearing(hearingId: string): Promise<{ id: string }> {
  const { data } = await apiClient.patch<{ message: string; id: string }>(
    `/hearings/${hearingId}/cancel`
  );
  return { id: data.id };
}

export async function listCourtrooms(): Promise<Courtroom[]> {
  const { data } = await apiClient.get<{ courtrooms: Courtroom[] }>(
    "/hearings/courtrooms"
  );
  return data.courtrooms;
}

export async function listHolidays(): Promise<Holiday[]> {
  const { data } = await apiClient.get<{ holidays: Holiday[] }>(
    "/hearings/holidays"
  );
  return data.holidays;
}

export async function addHoliday(payload: {
  date: string;
  reason: string;
}): Promise<Holiday> {
  const { data } = await apiClient.post<{ holiday: Holiday }>(
    "/hearings/holidays",
    payload
  );
  return data.holiday;
}

export async function deleteHoliday(id: string): Promise<{ id: string }> {
  const { data } = await apiClient.delete<{ message: string; id: string }>(
    `/hearings/holidays/${id}`
  );
  return { id: data.id };
}

export async function listRegistrarHearings(status?: string): Promise<Hearing[]> {
  const { data } = await apiClient.get<{ hearings: Hearing[] }>(
    "/hearings/registrar",
    { params: status ? { status } : {} }
  );
  return data.hearings;
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
