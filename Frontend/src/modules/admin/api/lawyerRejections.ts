import { apiClient } from "../../../shared/api/axios";

export type LawyerRejectionRecord = {
  id: string;
  email: string;
  cnic: string | null;
  barLicenseNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  specialization: string | null;
  districtBar: string | null;
  rejectionRemarks: string | null;
  rejectedByEmail: string | null;
  rejectedAt: string;
  storagePathsCleared: string[] | null;
};

export type LawyerRejectionHistoryResponse = {
  items: LawyerRejectionRecord[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
};

export async function fetchLawyerRejectionHistory(
  params: { limit?: number; offset?: number; search?: string } = {}
): Promise<LawyerRejectionHistoryResponse> {
  const { data } = await apiClient.get<LawyerRejectionHistoryResponse>(
    "/auth/lawyers/rejections",
    { params }
  );
  return data;
}
