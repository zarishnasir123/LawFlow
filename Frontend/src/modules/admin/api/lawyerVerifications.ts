import { apiClient } from "../../../shared/api/axios";

export type LawyerDocumentType =
  | "law_degree"
  | "bar_license_card"
  | "bar_license_card_front"
  | "bar_license_card_back";

export type PendingLawyerDocument = {
  documentType: LawyerDocumentType;
  storageBucket: string;
  storagePath: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  uploadedAt: string;
  previewUrl: string | null;
};

export type PendingLawyer = {
  lawyerProfileId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  cnic: string;
  accountStatus: string;
  emailVerified: boolean;
  specialization: string;
  districtBar: string;
  barLicenseNumber: string;
  experienceYears: number | null;
  consultationFee: number | null;
  cnicMatch: boolean;
  cnicMatchRemarks: string | null;
  verificationStatus: "pending" | "approved" | "rejected" | "suspended";
  verificationRemarks?: string | null;
  verifiedAt?: string | null;
  submittedAt: string;
  documents: PendingLawyerDocument[];
};

export type PendingLawyersResponse = {
  items: PendingLawyer[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
};

export type ActiveLawyersResponse = PendingLawyersResponse;

export type ReviewLawyerPayload = {
  lawyerProfileId: string;
  status: "approved" | "rejected";
  remarks?: string;
};

export type ReviewLawyerResponse = {
  message: string;
  lawyer: {
    lawyerProfileId: string;
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    emailVerified?: boolean;
    accountStatus?: string;
    userDeleted?: boolean;
    verificationStatus: "approved" | "rejected";
    verificationRemarks: string | null;
    verifiedBy: string | null;
    verifiedAt: string | null;
  };
};

export async function fetchPendingLawyers(
  params: { limit?: number; offset?: number } = {}
): Promise<PendingLawyersResponse> {
  const { data } = await apiClient.get<PendingLawyersResponse>(
    "/auth/lawyers/pending",
    { params }
  );
  return data;
}

export async function fetchActiveLawyers(
  params: { limit?: number; offset?: number } = {}
): Promise<ActiveLawyersResponse> {
  const { data } = await apiClient.get<ActiveLawyersResponse>(
    "/auth/lawyers/active",
    { params }
  );
  return data;
}

export async function reviewLawyer(
  payload: ReviewLawyerPayload
): Promise<ReviewLawyerResponse> {
  const { data } = await apiClient.patch<ReviewLawyerResponse>(
    `/auth/lawyers/${payload.lawyerProfileId}/review`,
    {
      status: payload.status,
      remarks: payload.remarks ?? null,
    }
  );
  return data;
}

export type SuspendLawyerPayload = {
  lawyerProfileId: string;
  reason: string;
};

export async function suspendLawyer(
  payload: SuspendLawyerPayload
): Promise<ReviewLawyerResponse> {
  const { data } = await apiClient.patch<ReviewLawyerResponse>(
    `/auth/lawyers/${payload.lawyerProfileId}/suspend`,
    { reason: payload.reason }
  );
  return data;
}

export async function reinstateLawyer(
  lawyerProfileId: string
): Promise<ReviewLawyerResponse> {
  const { data } = await apiClient.patch<ReviewLawyerResponse>(
    `/auth/lawyers/${lawyerProfileId}/reinstate`
  );
  return data;
}
