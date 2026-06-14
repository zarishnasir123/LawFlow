import { apiClient } from "../../../shared/api/axios";

// The four lifecycle statuses the backend allow-lists for the case table
// filter. Mirrors ADMIN_CASE_STATUSES in adminCases.service.js.
export type AdminCaseStatus = "draft" | "submitted" | "returned" | "accepted";

// Shared facts shape returned both by the list endpoint (one per row) and
// the detail endpoint's `case` block. Money fields are real numbers (or
// null) — the backend coerces pg's NUMERIC strings at its mapping boundary.
export type AdminCaseListItem = {
  id: string;
  title: string;
  caseType: string;
  category: string;
  lawyerName: string;
  clientName: string;
  status: AdminCaseStatus;
  assignedTehsil: string | null;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  registrarName: string | null;
  agreedFee: number | null;
  paidAmount: number;
  hasAgreement: boolean;
};

export type AdminCasesResponse = {
  items: AdminCaseListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
};

// The event_type values the timeline can carry. Real audit rows use the
// append-only set; "client_signed" / "lawyer_signed" are derived at
// read-time from completed signature requests, never stored as events.
export type CaseEventType =
  | "created"
  | "submitted"
  | "resubmitted"
  | "returned"
  | "accepted"
  | "client_signed"
  | "lawyer_signed"
  | "signed_pdf_compiled"
  | "edited"
  | "deleted";

// One timeline node. `payload` is event-type specific and loosely typed:
// "returned" carries reviewRemarks, signing nodes carry signerRole, backfilled
// rows carry backfill:true, "edited" carries changedFields, etc.
export type CaseEventPayload = {
  backfill?: boolean;
  fromStatus?: string;
  toStatus?: string;
  reviewRemarks?: string;
  signerRole?: string;
  changedFields?: string[];
  tehsil?: string | null;
  assignedTehsil?: string | null;
  storagePath?: string;
  [key: string]: unknown;
};

export type CaseTimelineEvent = {
  id: string;
  eventType: CaseEventType;
  actorName: string | null;
  actorRole: string | null;
  payload: CaseEventPayload;
  createdAt: string;
};

export type CasePaymentReadiness = {
  hasAgreement: boolean;
  agreedFee: number | null;
  lawyerBaseFee: number | null;
  paidAmount: number;
  agreementStatus: string | null;
  payoutEligible: boolean;
};

export type AdminCaseDetailResponse = {
  case: AdminCaseListItem;
  timeline: CaseTimelineEvent[];
  paymentReadiness: CasePaymentReadiness;
};

export type FetchAdminCasesParams = {
  search?: string;
  status?: AdminCaseStatus;
  limit?: number;
  offset?: number;
};

export async function fetchAdminCases(
  params: FetchAdminCasesParams = {}
): Promise<AdminCasesResponse> {
  const { data } = await apiClient.get<AdminCasesResponse>("/admin/cases", {
    params,
  });
  return data;
}

export async function fetchAdminCaseDetail(
  caseId: string
): Promise<AdminCaseDetailResponse> {
  const { data } = await apiClient.get<AdminCaseDetailResponse>(
    `/admin/cases/${caseId}`
  );
  return data;
}
